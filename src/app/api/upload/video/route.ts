import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

import { auth } from '@/auth'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import {
  getPresignedUploadUrl,
  deleteFromR2,
  deleteR2KeyDirect,
  getR2ObjectSize,
  buildArtworkVideoKey,
} from '@/lib/r2'

// 20MB max for video files
const MAX_VIDEO_SIZE = 20 * 1024 * 1024

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

// Valid R2 keys for artwork videos match exactly:
//   <env>/artists/<handler>/<artworkId>-<suffix>.<ext>
const VIDEO_KEY_RE =
  /^(production|staging)\/artists\/[a-z0-9-]+\/[a-zA-Z0-9_-]+-[a-f0-9]+\.(mp4|webm)$/

// Guard the finalize step: only accept a server-minted key that references
// THIS artwork. Without this, `complete` would trust a client-supplied URL
// and store it as `videoUrl` — which is later passed to deleteFromR2 on the
// next upload, giving any artist an arbitrary cross-tenant object-delete
// primitive. Mirrors isSafeOriginalKey in the image route.
function isSafeVideoKey(key: unknown, artworkId: string): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 256) return false
  if (key.includes('..') || key.includes('//')) return false
  if (!VIDEO_KEY_RE.test(key)) return false
  if (!key.includes(`/${artworkId}-`)) return false
  return true
}

/**
 * Client-side upload handler for videos via presigned R2 URLs.
 *
 * Flow:
 *  1. Client POSTs { artworkId, contentType, fileSize } to get a presigned PUT URL
 *  2. Client uploads directly to R2 using the presigned URL
 *  3. Client POSTs { artworkId, url, type: 'complete' } to finalize (update DB)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Authenticate the user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Step 1: Generate presigned upload URL
    if (body.type === 'request-upload') {
      const { artworkId, contentType, fileSize } = body

      if (!artworkId || !contentType) {
        return NextResponse.json({ error: 'Missing artworkId or contentType' }, { status: 400 })
      }

      if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
        return NextResponse.json(
          { error: 'Invalid file type. Accepted formats: MP4, WebM.' },
          { status: 400 },
        )
      }

      if (fileSize && fileSize > MAX_VIDEO_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 20MB.' },
          { status: 400 },
        )
      }

      // Verify artwork ownership
      const artwork = await prisma.artwork.findUnique({
        where: { id: artworkId },
        select: { userId: true },
      })

      if (!artwork) {
        return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
      }

      const userType = session.user.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
      if (artwork.userId !== session.user.id && !isAdminOrAbove) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      const ext = MIME_TO_EXT[contentType] || 'mp4'
      const key = await buildArtworkVideoKey(artwork.userId, artworkId, ext)
      const presignedUrl = await getPresignedUploadUrl(key, contentType)

      // Build the public URL (what will be stored in DB)
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

      return NextResponse.json({
        presignedUrl,
        publicUrl,
        key,
      })
    }

    // Step 2: Finalize upload (update DB after client uploads to R2)
    if (body.type === 'complete') {
      const { artworkId, key } = body

      if (!artworkId || !key) {
        return NextResponse.json({ error: 'Missing artworkId or key' }, { status: 400 })
      }

      // Only accept a server-minted key that references this artwork; never a
      // client-supplied URL. This closes the arbitrary-object-delete primitive.
      if (!isSafeVideoKey(key, artworkId)) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
      }

      // Verify artwork ownership
      const artwork = await prisma.artwork.findUnique({
        where: { id: artworkId },
        select: { userId: true, videoUrl: true },
      })

      if (!artwork) {
        return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
      }

      const userType = session.user.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
      if (artwork.userId !== session.user.id && !isAdminOrAbove) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      // The presigned PUT imposes no size ceiling, so verify the real object
      // size before committing it. Over-limit → delete and reject.
      const size = await getR2ObjectSize(key)
      if (size !== null && size > MAX_VIDEO_SIZE) {
        await deleteR2KeyDirect(key).catch(() => {})
        return NextResponse.json(
          { error: 'File too large. Maximum size is 20MB.' },
          { status: 400 },
        )
      }

      const r2PublicUrl = process.env.R2_PUBLIC_URL
      if (!r2PublicUrl) {
        console.error('[POST /api/upload/video] R2_PUBLIC_URL is not configured')
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }
      // Rebuild the public URL from the validated key — we never store a
      // client-supplied value, so `videoUrl` is always this artwork's own key
      // and the delete-old-video call below can only target our own object.
      const url = `${r2PublicUrl}/${key}`

      // Delete old video if exists
      if (artwork.videoUrl) {
        try {
          await deleteFromR2(artwork.videoUrl)
        } catch (error) {
          console.warn('Failed to delete old video:', error)
        }
      }

      // Update artwork with new video URL
      await prisma.artwork.update({
        where: { id: artworkId },
        data: { videoUrl: url },
      })

      revalidateTag(`artwork-${artworkId}`, 'default')

      return NextResponse.json({ url })
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    // Never leak raw error messages to the client — DNS/ECONNREFUSED and R2
    // SDK strings would turn this endpoint into a network/recon oracle. Log
    // the detail server-side only (mirrors the artwork-image route).
    console.error('[POST /api/upload/video] error:', error)
    captureError(error, {
      flow: 'upload',
      stage: 'artwork-video',
      level: 'error',
      fingerprint: ['upload:artwork-video-failed'],
    })
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
