import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

import { auth } from '@/auth'
import { MAX_ARTWORK_UPLOAD_SIZE } from '@/lib/imageConfig'
import { processImage, isValidImageType } from '@/lib/imageProcessor'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import {
  uploadToR2,
  deleteFromR2,
  getPresignedUploadUrl,
  buildArtworkImageKey,
  buildOriginalImageKey,
} from '@/lib/r2'

// Restricted to formats both print providers accept. The Print Space
// only takes JPEG, PNG and TIFF, matching theprintspace's
// is the safe intersection for the artwork-image pipeline.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/tiff']

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tif',
}

/**
 * Client-side upload handler for artwork images via presigned R2 URLs.
 *
 * Flow:
 *  1. Client POSTs { type: 'request-upload', artworkId, contentType, fileSize }
 *     → returns presigned URL for the original + the R2 key for the original
 *  2. Client uploads the original directly to R2 using the presigned URL
 *  3. Client POSTs { type: 'complete', artworkId, originalKey }
 *     → server rebuilds the public URL server-side from originalKey,
 *       downloads the original, generates web-optimized WebP,
 *       uploads that to CDN path, updates DB with both URLs + dimensions
 *
 * Security note: the `complete` step deliberately does NOT accept an
 * arbitrary `originalUrl`. That would be an SSRF primitive (server
 * fetches attacker-controlled URL) and an image-substitution vector
 * (attacker uploads a clean preview to R2, then points originalKey at
 * external content that the print provider later fetches for printing). Instead we
 * validate `originalKey` is a well-formed R2 key under our own bucket
 * prefix, rebuild the URL from it, and only fetch our own bucket.
 */

// Valid R2 keys for artwork originals match exactly:
//   artworks-original/<envPrefix>/<handler>/<artworkId>-<suffix>.<ext>
// Extension is restricted to the mime map above.
const ORIGINAL_KEY_RE =
  /^artworks-original\/[a-z0-9-]+\/[a-z0-9-]+\/[a-zA-Z0-9_-]+-[a-zA-Z0-9]+\.(jpg|png|tif)$/

function isSafeOriginalKey(key: unknown, artworkId: string): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 256) return false
  if (key.includes('..') || key.includes('//')) return false
  if (!ORIGINAL_KEY_RE.test(key)) return false
  // The key must reference this specific artwork — stops one artist from
  // reusing another's upload URL, even with a valid key shape.
  if (!key.includes(`/${artworkId}-`)) return false
  return true
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Step 1: Generate presigned upload URL for the original
    if (body.type === 'request-upload') {
      const { artworkId, contentType, fileSize } = body

      if (!artworkId || !contentType) {
        return NextResponse.json({ error: 'Missing artworkId or contentType' }, { status: 400 })
      }

      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        return NextResponse.json(
          { error: 'Invalid file type. Accepted: JPG, PNG, TIFF.' },
          { status: 400 },
        )
      }

      if (fileSize && fileSize > MAX_ARTWORK_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: `File too large. Maximum is ${MAX_ARTWORK_UPLOAD_SIZE / (1024 * 1024)}MB.` },
          { status: 400 },
        )
      }

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

      const ext = MIME_TO_EXT[contentType] || 'jpg'
      const originalKey = await buildOriginalImageKey(artwork.userId, artworkId, ext)
      const presignedUrl = await getPresignedUploadUrl(originalKey, contentType)
      const originalUrl = `${process.env.R2_PUBLIC_URL}/${originalKey}`

      return NextResponse.json({ presignedUrl, originalUrl, originalKey })
    }

    // Step 2: Finalize — download original from R2, generate web version, update DB
    if (body.type === 'complete') {
      const { artworkId, originalKey } = body

      if (!artworkId || !originalKey) {
        return NextResponse.json({ error: 'Missing artworkId or originalKey' }, { status: 400 })
      }

      if (!isSafeOriginalKey(originalKey, artworkId)) {
        return NextResponse.json({ error: 'Invalid originalKey' }, { status: 400 })
      }

      const artwork = await prisma.artwork.findUnique({
        where: { id: artworkId },
        select: { userId: true, imageUrl: true, originalImageUrl: true },
      })

      if (!artwork) {
        return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
      }

      const userType = session.user.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
      if (artwork.userId !== session.user.id && !isAdminOrAbove) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      // Rebuild the public URL from the validated key — we never use a
      // URL supplied by the client, so no SSRF / host substitution is
      // possible.
      const r2PublicUrl = process.env.R2_PUBLIC_URL
      if (!r2PublicUrl) {
        console.error('[POST /api/upload/image] R2_PUBLIC_URL is not configured')
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }
      const originalUrl = `${r2PublicUrl}/${originalKey}`

      // Download the original from R2 to process it
      const originalResponse = await fetch(originalUrl)
      if (!originalResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch uploaded original' }, { status: 500 })
      }

      const originalBuffer = Buffer.from(await originalResponse.arrayBuffer())

      if (!isValidImageType(originalBuffer)) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload a JPG, PNG, or TIFF image.' },
          { status: 400 },
        )
      }

      // Get original dimensions, DPI, format, and size.
      // No orientation transform — TPS prints the file's raw pixels
      // ignoring any EXIF orientation tag, so we honor the same
      // convention everywhere: the pixel layout IS the truth.
      const sharp = (await import('sharp')).default
      const metadata = await sharp(originalBuffer).metadata()
      const originalWidth = metadata.width ?? 0
      const originalHeight = metadata.height ?? 0
      const originalDpi = metadata.density ?? null
      const formatMap: Record<string, string> = {
        jpeg: 'JPEG',
        png: 'PNG',
        tiff: 'TIFF',
      }
      const originalFormat =
        formatMap[metadata.format ?? ''] ?? metadata.format?.toUpperCase() ?? null
      const originalSizeBytes = originalBuffer.length

      // Generate web-optimized version
      const processedBuffer = await processImage(originalBuffer)

      // Delete old images if they exist
      if (artwork.imageUrl) {
        try {
          await deleteFromR2(artwork.imageUrl)
        } catch (error) {
          console.warn('Failed to delete old web image:', error)
        }
      }
      if (artwork.originalImageUrl) {
        try {
          await deleteFromR2(artwork.originalImageUrl)
        } catch (error) {
          console.warn('Failed to delete old original image:', error)
        }
      }

      // Upload web-optimized version to CDN path
      const webKey = await buildArtworkImageKey(artwork.userId, artworkId)
      const webUrl = await uploadToR2(webKey, processedBuffer, 'image/webp')

      // Update artwork with both URLs + dimensions
      await prisma.artwork.update({
        where: { id: artworkId },
        data: {
          imageUrl: webUrl,
          originalImageUrl: originalUrl,
          originalWidth,
          originalHeight,
          originalDpi,
          originalFormat,
          originalSizeBytes,
        },
      })

      revalidateTag(`artwork-${artworkId}`, 'default')

      return NextResponse.json({
        imageUrl: webUrl,
        originalImageUrl: originalUrl,
        originalWidth,
        originalHeight,
        originalDpi,
        originalFormat,
        originalSizeBytes,
      })
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    // Never leak raw error messages to the client — DNS failures,
    // ECONNREFUSED with port info, etc. would turn this endpoint into a
    // network oracle. Log the full detail server-side only.
    console.error('[POST /api/upload/image] error:', error)
    captureError(error, {
      flow: 'upload',
      stage: 'artwork-image',
      level: 'error',
      fingerprint: ['upload:artwork-image-failed'],
    })
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
