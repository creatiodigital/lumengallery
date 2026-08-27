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
  getR2ObjectSize,
  buildArtworkImageKey,
  buildOriginalImageKey,
} from '@/lib/r2'

/**
 * Without this, Vercel applies its low platform default and the `complete`
 * phase 504s — which is exactly what happened in production on 2026-08-25 with
 * an 8.9 MB / 6000×6000 JPEG that processed in ~1.9 s locally against the same
 * R2 bucket.
 *
 * The work here is genuinely expensive and, crucially, its cost barely tracks
 * the uploaded file's size: JPEG decode uses shrink-on-load, so what dominates
 * is a cold-start load of sharp's native bindings plus the fixed WebP encodes at
 * 2048² in `processImage`. That is why a 160 MB upload succeeded two days before
 * an 8.9 MB one failed — the route had always sat at the edge of the default
 * budget, and only the warm/cold difference decided which side it landed on.
 *
 * 60 s is generous for a route a signed-in artist triggers by hand, and still
 * well under Vercel's ceiling.
 */
export const maxDuration = 60

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

      // The presigned PUT imposes no size ceiling and the declared fileSize is
      // client-supplied (and optional), so verify the REAL object size via
      // HeadObject BEFORE downloading — otherwise a multi-GB body would be
      // pulled fully into memory before we could reject it. Over-limit →
      // delete the object and reject.
      // Step timing, emitted as it goes. A function killed by
      // FUNCTION_INVOCATION_TIMEOUT never reaches its catch block, so Sentry
      // sees nothing and the only evidence of WHERE it died is whatever was
      // already written to the log. On 2026-08-25 that evidence did not exist
      // and the incident had to be narrowed by reasoning instead of reading.
      const t0 = Date.now()
      let last = t0
      const mark = (step: string) => {
        const now = Date.now()
        console.log(`[upload/image] ${step}: ${now - last}ms (total ${now - t0}ms)`)
        last = now
      }

      // Held for the cleanup that now runs at the very END, after the row has
      // been repointed at the new files.
      const previousImageUrl = artwork.imageUrl
      const previousOriginalUrl = artwork.originalImageUrl

      const uploadedSize = await getR2ObjectSize(originalKey)
      mark('headObject')
      if (uploadedSize !== null && uploadedSize > MAX_ARTWORK_UPLOAD_SIZE) {
        await deleteFromR2(originalUrl).catch(() => {})
        return NextResponse.json(
          { error: `File too large. Maximum is ${MAX_ARTWORK_UPLOAD_SIZE / (1024 * 1024)}MB.` },
          { status: 400 },
        )
      }

      // Download the original from R2 to process it
      const originalResponse = await fetch(originalUrl)
      if (!originalResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch uploaded original' }, { status: 500 })
      }

      const originalBuffer = Buffer.from(await originalResponse.arrayBuffer())
      mark(`downloadOriginal(${(originalBuffer.length / 1024 / 1024).toFixed(1)}MB)`)

      // Fallback for the rare case HeadObject returned null (size unknown):
      // the body is in memory now, so reject before handing it to sharp.
      if (originalBuffer.length > MAX_ARTWORK_UPLOAD_SIZE) {
        await deleteFromR2(originalUrl).catch(() => {})
        return NextResponse.json(
          { error: `File too large. Maximum is ${MAX_ARTWORK_UPLOAD_SIZE / (1024 * 1024)}MB.` },
          { status: 400 },
        )
      }

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
      mark(
        `metadata(${originalWidth}x${originalHeight}, ${((originalWidth * originalHeight) / 1e6).toFixed(1)}MP)`,
      )

      // Generate web-optimized version
      const processedBuffer = await processImage(originalBuffer)
      mark(`processImage(-> ${(processedBuffer.length / 1024).toFixed(0)}KB)`)

      // Upload the replacement FIRST, and only delete the old files once the
      // database points at the new ones.
      //
      // This used to run the other way round: delete, then upload, then update.
      // Every moment between the delete and the update was a window in which the
      // artwork's only image had been destroyed while the row still referenced
      // it — a blank frame on the wall and no way back. That window is not
      // theoretical: on 2026-08-25 this handler was killed mid-flight by a
      // function timeout on exactly this path. It happened to die BEFORE the
      // deletes; a second later and the artist's only copy would have been gone.
      //
      // Ordered this way the worst case is a harmless orphan — the new object
      // exists, nothing references it, and `scripts/reconcile-r2.ts` sweeps it.
      // Losing bytes is unacceptable; leaking a few is not.
      const webKey = await buildArtworkImageKey(artwork.userId, artworkId)
      const webUrl = await uploadToR2(webKey, processedBuffer, 'image/webp')
      mark('uploadWebp')

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

      // Now that the row points at the new files, retire the old ones. Failures
      // here are logged and swallowed: the replacement has already succeeded,
      // and an undeleted orphan must never turn a completed upload into an error.
      if (previousImageUrl && previousImageUrl !== webUrl) {
        try {
          await deleteFromR2(previousImageUrl)
        } catch (error) {
          console.warn('Failed to delete old web image:', error)
        }
      }
      if (previousOriginalUrl && previousOriginalUrl !== originalUrl) {
        try {
          await deleteFromR2(previousOriginalUrl)
        } catch (error) {
          console.warn('Failed to delete old original image:', error)
        }
      }
      mark('deleteOldImages')

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
