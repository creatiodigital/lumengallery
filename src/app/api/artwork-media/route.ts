import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

import { auth } from '@/auth'
import {
  getArtworkMedia,
  MAX_ARTWORK_MEDIA,
  MAX_ARTWORK_MEDIA_VIDEOS,
} from '@/lib/artwork/artworkMedia'
import { isValidImageType } from '@/lib/imageProcessor'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import {
  buildArtworkSupplementaryKey,
  deleteFromR2,
  deleteR2KeyDirect,
  getPresignedUploadUrl,
  getR2ObjectSize,
} from '@/lib/r2'
import { rateLimit } from '@/lib/rateLimit'
import { isValidVideoType } from '@/lib/videoType'

/**
 * Supplementary artwork media — upload and removal.
 *
 * ADMIN ONLY. The main artwork image stays artist-or-admin because the work is
 * the artist's; this is the gallery's sales presentation, so it is deliberately
 * narrower than the surface it sits beside.
 *
 * Modelled on /api/upload/image, which is the house pattern: ownership checked
 * on BOTH steps, a MIME allowlist, the declared size AND the real one, a key
 * shape bound to this specific artwork, no client-supplied URL anywhere, and
 * magic-byte validation of what actually landed.
 */
const ALLOWED = {
  'image/jpeg': { ext: 'jpg', kind: 'image' as const, max: 25 * 1024 * 1024 },
  'image/png': { ext: 'png', kind: 'image' as const, max: 25 * 1024 * 1024 },
  'image/webp': { ext: 'webp', kind: 'image' as const, max: 25 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', kind: 'video' as const, max: 20 * 1024 * 1024 },
  'video/webm': { ext: 'webm', kind: 'video' as const, max: 20 * 1024 * 1024 },
}

/**
 * Keys we minted, and no others:
 *   <env>/artists/<handler>/<artworkId>/supplementary/<suffix>.<ext>
 */
const KEY_RE =
  /^[a-z0-9-]+\/artists\/[a-z0-9-]+\/[a-zA-Z0-9_-]+\/supplementary\/[a-zA-Z0-9]+\.(jpg|png|webp|mp4|webm)$/

function isSafeKey(key: unknown, artworkId: string): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 256) return false
  if (key.includes('..') || key.includes('//')) return false
  if (!KEY_RE.test(key)) return false
  // Must sit under THIS artwork's folder — a well-formed key belonging to
  // another artwork is still someone else's object.
  return key.includes(`/${artworkId}/supplementary/`)
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated', status: 401 as const }
  const t = session.user.userType
  if (t !== 'admin' && t !== 'superAdmin') {
    return { error: 'Not authorized', status: 403 as const }
  }
  return { userId: session.user.id }
}

/** The artwork's media, for the admin manager. Admin-only like the rest of this
 *  route — the public page reads the same rows through `getArtworkMedia`. */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if ('error' in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }
  const artworkId = new URL(request.url).searchParams.get('artworkId')
  if (!artworkId) return NextResponse.json({ error: 'Missing artworkId' }, { status: 400 })

  return NextResponse.json({ media: await getArtworkMedia(artworkId) })
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    // Presigning is cheap for us and expensive for the bucket. Bound it per
    // admin so a runaway client cannot mint URLs indefinitely.
    const { success } = await rateLimit({
      name: 'artwork-media-upload',
      key: gate.userId,
      limit: 40,
      windowSeconds: 3600,
    })
    if (!success) {
      return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 })
    }

    const body = await request.json()
    const { artworkId } = body
    if (typeof artworkId !== 'string' || !artworkId) {
      return NextResponse.json({ error: 'Missing artworkId' }, { status: 400 })
    }

    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      select: { userId: true },
    })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })

    if (body.type === 'request-upload') {
      const spec = ALLOWED[body.contentType as keyof typeof ALLOWED]
      if (!spec) {
        return NextResponse.json(
          { error: 'Invalid file type. Accepted: JPG, PNG, WebP, MP4, WebM.' },
          { status: 400 },
        )
      }
      if (typeof body.fileSize === 'number' && body.fileSize > spec.max) {
        return NextResponse.json(
          { error: `File too large. Maximum is ${spec.max / (1024 * 1024)}MB.` },
          { status: 400 },
        )
      }

      // A ceiling far above real use, so a careless or compromised account
      // cannot fill the bucket. Counted here, before a URL is minted.
      const existing = await prisma.artworkMedia.findMany({
        where: { artworkId },
        select: { kind: true },
      })
      if (existing.length >= MAX_ARTWORK_MEDIA) {
        return NextResponse.json(
          { error: `This artwork already holds the maximum of ${MAX_ARTWORK_MEDIA} assets.` },
          { status: 400 },
        )
      }
      if (
        spec.kind === 'video' &&
        existing.filter((m) => m.kind === 'video').length >= MAX_ARTWORK_MEDIA_VIDEOS
      ) {
        return NextResponse.json(
          { error: `At most ${MAX_ARTWORK_MEDIA_VIDEOS} videos per artwork.` },
          { status: 400 },
        )
      }

      const key = await buildArtworkSupplementaryKey(artwork.userId, artworkId, spec.ext)
      const presignedUrl = await getPresignedUploadUrl(key, body.contentType)
      return NextResponse.json({ presignedUrl, key, kind: spec.kind })
    }

    if (body.type === 'complete') {
      const { key, width, height, caption } = body
      if (!isSafeKey(key, artworkId)) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
      }

      const ext = key.split('.').pop() as string
      const kind = ext === 'mp4' || ext === 'webm' ? 'video' : 'image'
      const max = kind === 'video' ? 20 * 1024 * 1024 : 25 * 1024 * 1024

      // The presigned PUT imposes no ceiling and the declared size was the
      // client's word, so check the real object before committing it.
      const size = await getR2ObjectSize(key)
      if (size !== null && size > max) {
        await deleteR2KeyDirect(key).catch(() => {})
        return NextResponse.json(
          { error: `File too large. Maximum is ${max / (1024 * 1024)}MB.` },
          { status: 400 },
        )
      }

      const r2PublicUrl = process.env.R2_PUBLIC_URL
      if (!r2PublicUrl) {
        console.error('[POST /api/artwork-media] R2_PUBLIC_URL is not configured')
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }
      // Rebuilt from the validated key. A client-supplied URL here would be an
      // SSRF primitive and a substitution vector both.
      const url = `${r2PublicUrl}/${key}`

      // What the client DECLARED is a string it chose; these objects sit in a
      // public bucket on a domain we own, so HTML uploaded as `image/png` would
      // be fetchable and executable from our own host. Only the header is read.
      const head = await fetch(url, { headers: { Range: 'bytes=0-63' } })
      const magic = head.ok ? Buffer.from(await head.arrayBuffer()) : Buffer.alloc(0)
      const valid = kind === 'video' ? isValidVideoType(magic) : isValidImageType(magic)
      if (!valid) {
        await deleteR2KeyDirect(key).catch(() => {})
        return NextResponse.json(
          { error: 'That file is not a valid image or video.' },
          { status: 400 },
        )
      }

      const last = await prisma.artworkMedia.findFirst({
        where: { artworkId },
        orderBy: { order: 'desc' },
        select: { order: true },
      })

      const created = await prisma.artworkMedia.create({
        data: {
          artworkId,
          kind,
          url,
          width: typeof width === 'number' ? width : null,
          height: typeof height === 'number' ? height : null,
          // Plain text only — never HTML.
          caption:
            typeof caption === 'string' && caption.trim() ? caption.trim().slice(0, 300) : null,
          order: (last?.order ?? -1) + 1,
        },
        select: { id: true, kind: true, url: true, width: true, height: true, caption: true },
      })

      revalidateTag(`artwork-${artworkId}`, 'default')
      return NextResponse.json(created)
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/artwork-media] error:', error)
    captureError(error, { flow: 'upload', stage: 'artwork-media', level: 'error' })
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

/**
 * Remove one asset.
 *
 * Takes a ROW ID, never a key or a URL. The row is loaded, its artwork checked,
 * and the object deleted using the URL STORED IN THE ROW — so no string the
 * client chose ever reaches R2. The bucket has no versioning and a signed-in
 * user can otherwise delete any object in it; this endpoint must not widen that.
 */
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const { id } = await request.json()
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const row = await prisma.artworkMedia.findUnique({
      where: { id },
      select: { id: true, url: true, artworkId: true },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.artworkMedia.delete({ where: { id: row.id } })

    // Row first, object second: an orphaned object is swept by
    // scripts/reconcile-r2.ts, whereas a row pointing at a deleted file renders
    // as a broken image on a public page.
    await deleteFromR2(row.url).catch((e) =>
      console.warn('[DELETE /api/artwork-media] object not removed:', e),
    )

    revalidateTag(`artwork-${row.artworkId}`, 'default')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/artwork-media] error:', error)
    captureError(error, { flow: 'upload', stage: 'artwork-media-delete', level: 'error' })
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
