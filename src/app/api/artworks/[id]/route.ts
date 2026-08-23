import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import type { NextRequest } from 'next/server'
import { deleteFromR2 } from '@/lib/r2'

import { isAdminOrAbove, requireOwnership } from '@/lib/authUtils'
import { PUBLIC_ARTWORK_OMIT } from '@/lib/artworkFields'
import { saveLimitedVariants } from '@/lib/editions/saveLimitedVariants'
import { parseIncomingVariants } from '@/lib/editions/parseIncomingVariants'
import { TPS_FRAME_TYPES, TPS_PAPERS, TPS_WINDOW_MOUNTS } from '@/lib/print-providers/printspace'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'
import { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'
import { generateUniqueSlug } from '@/lib/slugify'
import { sanitizeLine } from '@/utils/sanitizeLine'

// Defense-in-depth: only persist printOptions whose shape matches what
// the wizard understands. Any unknown keys or unknown ids get dropped.
// Empty/all-covering dimensions are stripped — null stands for "no
// restrictions" throughout the stack.
//
// Canonical PrintRestrictions shape: `{ allowed: { dimId: ids[] } }`.
function cleanIds(arr: unknown, universe: readonly { id: string }[]): string[] | undefined {
  if (!Array.isArray(arr)) return undefined
  const universeIds = new Set(universe.map((u) => u.id))
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of arr) {
    if (typeof item !== 'string') continue
    if (!universeIds.has(item)) continue
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  // Whole-universe-or-empty ≡ no restriction → drop.
  if (out.length === 0 || out.length === universe.length) return undefined
  return out
}

function sanitizePrintOptions(raw: unknown): PrintRestrictions | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const inner =
    obj.allowed && typeof obj.allowed === 'object' ? (obj.allowed as Record<string, unknown>) : null
  if (!inner) return null
  const next: Record<string, string[]> = {}
  const paperIds = cleanIds(inner.paper, TPS_PAPERS)
  const frameTypeIds = cleanIds(inner.frameType, TPS_FRAME_TYPES)
  const windowMountIds = cleanIds(inner.windowMount, TPS_WINDOW_MOUNTS)
  if (paperIds) next.paper = paperIds
  if (frameTypeIds) next.frameType = frameTypeIds
  if (windowMountIds) next.windowMount = windowMountIds
  return Object.keys(next).length === 0 ? null : { allowed: next }
}

// Sanitize artist-set recommendations. Today only paper IDs are
// accepted. Any paper that's been hard-restricted in `printOptions`
// is dropped here — a paper can't be both vetoed and recommended.
function sanitizePrintRecommendations(
  raw: unknown,
  restrictions: PrintRestrictions | null,
): PrintRecommendations | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const paperIdsRaw = obj.paper
  if (!Array.isArray(paperIdsRaw)) return null
  const universeIds = new Set<string>(TPS_PAPERS.map((p) => p.id))
  const allowedPapers = restrictions?.allowed?.paper
  const allowedSet = allowedPapers ? new Set(allowedPapers) : null
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of paperIdsRaw) {
    if (typeof item !== 'string') continue
    if (!universeIds.has(item)) continue
    if (allowedSet && !allowedSet.has(item)) continue
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out.length === 0 ? null : { paper: out }
}

// The exhibition profile API (/api/exhibitions/by-url/[url]) caches its
// merged snapshot+live response under `exhibition-${url}` with a 1-hour
// revalidate window. Artwork edits (title, image, etc.) would otherwise
// stay invisible on the public page until that window expired — bust
// every exhibition tag that currently includes this artwork.
async function revalidateLinkedExhibitions(artworkId: string) {
  const linked = await prisma.exhibitionArtwork.findMany({
    where: { artworkId },
    select: { exhibition: { select: { url: true } } },
  })
  for (const { exhibition } of linked) {
    if (exhibition?.url) revalidateTag(`exhibition-${exhibition.url}`, 'default')
  }
}

// GET single artwork
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      // Never expose the full-res master URL / metadata on this public read.
      omit: PUBLIC_ARTWORK_OMIT,
      include: {
        limitedVariants: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    // How many copies of each variant are already committed (reserved or sold).
    // The dashboard needs this to tell the truth about what can be deleted: a
    // variant an admin has unblocked shows no "Currently Selling" badge, yet
    // still can't be removed if a real order owns one of its numbers. Without
    // it the editor offers a Delete button the server can only refuse.
    const variantIds = artwork.limitedVariants.map((v) => v.id)
    const committedByVariant = new Map<string, number>()
    if (variantIds.length > 0) {
      const grouped = await prisma.editionNumber.groupBy({
        by: ['variantId'],
        where: { variantId: { in: variantIds }, state: { in: ['reserved', 'sold'] } },
        _count: { _all: true },
      })
      for (const g of grouped) committedByVariant.set(g.variantId, g._count._all)
    }

    return NextResponse.json({
      ...artwork,
      limitedVariants: artwork.limitedVariants.map((v) => ({
        ...v,
        committedCount: committedByVariant.get(v.id) ?? 0,
      })),
    })
  } catch (error) {
    console.error('[GET /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT update artwork (requires auth + ownership)
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Verify ownership
    const existing = await prisma.artwork.findUnique({
      where: { id },
      select: {
        userId: true,
        title: true,
        slug: true,
        editionType: true,
        editionLocked: true,
        originalWidth: true,
        originalHeight: true,
      },
    })
    if (!existing) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    const { error: authError, session } = await requireOwnership(existing.userId)
    if (authError) return authError
    const requesterIsAdmin = isAdminOrAbove(session?.user?.userType)

    const body = await request.json()

    // Sanitize single-line text fields. `description` and `textContent`
    // are rich-text HTML — left untouched here, DOMPurify cleans at
    // render time. Length caps reject oversized payloads (defense
    // against control-char padding).
    if (body.title !== undefined) body.title = sanitizeLine(String(body.title))
    if (body.author !== undefined) body.author = sanitizeLine(String(body.author))
    if (body.year !== undefined) body.year = sanitizeLine(String(body.year))
    if (body.technique !== undefined) body.technique = sanitizeLine(String(body.technique))
    if (body.dimensions !== undefined) body.dimensions = sanitizeLine(String(body.dimensions))

    if (
      (typeof body.title === 'string' && body.title.length > 200) ||
      (typeof body.author === 'string' && body.author.length > 150) ||
      (typeof body.year === 'string' && body.year.length > 30) ||
      (typeof body.technique === 'string' && body.technique.length > 200) ||
      (typeof body.dimensions === 'string' && body.dimensions.length > 100)
    ) {
      return NextResponse.json({ error: 'One or more fields are too long.' }, { status: 400 })
    }

    // Regenerate slug if title changed
    const titleChanged = body.title && body.title !== existing.title
    const slug = titleChanged ? await generateUniqueSlug(body.title) : undefined

    // Tags for cache busting below — by-id + by-slug (old + new if slug changed).
    const slugTags = [existing.slug, slug].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    )

    // Normalize print-sales inputs. `printPriceCents` is an integer in
    // minor units (cents); null means "price not set". `printEnabled`
    // without a price still persists — the checkout gate checks for both.
    const rawPrice = body.printPriceCents
    const parsedPrice =
      rawPrice === null || rawPrice === undefined || rawPrice === '' ? null : Number(rawPrice)
    const printPriceCents =
      parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0
        ? Math.round(parsedPrice)
        : null

    // Limited-edition fields. `printEditionTotal` is an integer count
    // of prints in the series; meaningful only when the flag is on.
    const printEditionLimited =
      body.printEditionLimited === true || body.printEditionLimited === 'true'
    const rawEditionTotal = body.printEditionTotal
    const parsedEditionTotal =
      rawEditionTotal === null || rawEditionTotal === undefined || rawEditionTotal === ''
        ? null
        : Number(rawEditionTotal)
    const printEditionTotal =
      parsedEditionTotal !== null && Number.isFinite(parsedEditionTotal) && parsedEditionTotal > 0
        ? Math.round(parsedEditionTotal)
        : null

    // Edition type — the canonical open/limited switch. One-way door:
    // once an artwork is locked (a variant has been published) it can
    // never revert to 'open'. Defaults to the stored value when the body
    // doesn't carry it.
    const requestedEditionType =
      body.editionType === 'limited' || body.editionType === 'open'
        ? body.editionType
        : existing.editionType
    // Once an artwork is locked ("Start selling"), the artist can't change
    // the edition type — only an admin can (after unblocking). Block any
    // edition-type change by a non-admin on a locked artwork.
    if (
      existing.editionLocked &&
      requestedEditionType !== existing.editionType &&
      !requesterIsAdmin
    ) {
      return NextResponse.json(
        { error: 'This artwork is locked for sale. Only an admin can change its edition type.' },
        { status: 409 },
      )
    }
    const editionType = requestedEditionType

    // Sanitize artist-set printing restrictions.
    const printOptions = sanitizePrintOptions(body.printOptions)
    // Sanitize recommendations — depends on restrictions to enforce the
    // "can't recommend a vetoed paper" invariant.
    const printRecommendations = sanitizePrintRecommendations(
      body.printRecommendations,
      printOptions,
    )

    // Base update data (fields that definitely exist)
    // Sync name with title so all consumers see the updated label
    const baseData = {
      name: body.title || body.name,
      artworkType: body.artworkType,
      title: body.title,
      ...(slug && { slug }),
      author: body.author,
      year: body.year,
      technique: body.technique,
      dimensions: body.dimensions,
      description: body.description,
      textContent: body.textContent,
      featured: body.featured === true || body.featured === 'true',
      printEnabled: body.printEnabled === true || body.printEnabled === 'true',
      printPriceCents,
      editionType,
      printEditionLimited,
      printEditionTotal,
      // Prisma's nullable-Json update slot doesn't accept a bare `null`
      // — the DB NULL value is signaled via Prisma.DbNull sentinel.
      printOptions:
        printOptions === null ? Prisma.DbNull : (printOptions as unknown as Prisma.InputJsonValue),
      printRecommendations:
        printRecommendations === null
          ? Prisma.DbNull
          : (printRecommendations as unknown as Prisma.InputJsonValue),
    }

    // Try with new fields first
    try {
      const artwork = await prisma.artwork.update({
        where: { id },
        data: {
          ...baseData,
          hiddenFromExhibition:
            body.hiddenFromExhibition === true || body.hiddenFromExhibition === 'true',
        },
      })

      // Reconcile limited-edition variants (draft create/update/delete).
      // Publishing — which materialises edition numbers and locks the
      // artwork — is a separate explicit action (POST .../publish-edition).
      if (editionType === 'limited' && Array.isArray(body.limitedVariants)) {
        const incoming = parseIncomingVariants(body.limitedVariants)
        const saved = await saveLimitedVariants({
          artworkId: id,
          artworkPixels: {
            widthPx: existing.originalWidth ?? 0,
            heightPx: existing.originalHeight ?? 0,
          },
          variants: incoming,
        })
        if (!saved.ok) {
          return NextResponse.json({ error: saved.error }, { status: 400 })
        }
      }

      // Bust caches that include this artwork's data. `page-prints` and
      // `artworks` are global listing tags — without busting them, the
      // /prints page and the artist profile can show stale presence/
      // absence (e.g. just-enabled print artwork missing for up to an
      // hour after the toggle).
      revalidateTag(`artwork-${id}`, 'default')
      for (const s of slugTags) revalidateTag(`artwork-slug-${s}`, 'default')
      revalidateTag('page-prints', 'default')
      revalidateTag('artworks', 'default')
      await revalidateLinkedExhibitions(id)

      return NextResponse.json(artwork)
    } catch (innerError) {
      // If new field fails, try without it (fallback for schema mismatch)
      console.warn('[PUT /api/artworks/[id]] retrying without new fields:', innerError)
      const artwork = await prisma.artwork.update({
        where: { id },
        data: baseData,
      })

      // Bust caches that include this artwork's data
      revalidateTag(`artwork-${id}`, 'default')
      for (const s of slugTags) revalidateTag(`artwork-slug-${s}`, 'default')
      revalidateTag('page-prints', 'default')
      revalidateTag('artworks', 'default')
      await revalidateLinkedExhibitions(id)

      return NextResponse.json(artwork)
    }
  } catch (error) {
    console.error('[PUT /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to update artwork' }, { status: 500 })
  }
}

// DELETE artwork (requires auth + ownership)
/** Shape stored in Exhibition.autofocusGroups (JSON, hence hand-typed here). */
type AutofocusGroupJson = { id: string; name: string; artworkIds: string[] }

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Get artwork first to check for image and verify ownership.
    // Pulling user.handler so we can revalidate the artist profile cache
    // tag after the row is gone.
    const artwork = await prisma.artwork.findUnique({
      where: { id },
      include: { user: { select: { handler: true } } },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    // Verify ownership
    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    // Snapshot linked exhibition urls before the cascade wipes the
    // ExhibitionArtwork join rows — we need them to bust caches after
    // the delete completes.
    const linkedExhibitions = await prisma.exhibitionArtwork.findMany({
      where: { artworkId: id },
      select: { exhibition: { select: { url: true } } },
    })

    // Delete web-optimized image from R2 if exists
    if (artwork.imageUrl) {
      try {
        await deleteFromR2(artwork.imageUrl)
      } catch (error) {
        console.warn('Failed to delete image blob:', error)
        // Continue anyway - file might not exist
      }
    }

    // Delete high-res original from R2 if exists. Without this, the
    // raw uploaded TIFF/PNG/JPEG (often tens of MB) is orphaned in R2
    // every time an artist removes a piece from their library.
    if (artwork.originalImageUrl) {
      try {
        await deleteFromR2(artwork.originalImageUrl)
      } catch (error) {
        console.warn('Failed to delete original image blob:', error)
      }
    }

    // Delete associated sound from R2 if exists
    if (artwork.soundUrl) {
      try {
        await deleteFromR2(artwork.soundUrl)
      } catch (error) {
        console.warn('Failed to delete sound blob:', error)
      }
    }

    // Delete associated video from R2 if exists
    if (artwork.videoUrl) {
      try {
        await deleteFromR2(artwork.videoUrl)
      } catch (error) {
        console.warn('Failed to delete video blob:', error)
      }
    }

    // Strip the artwork from every exhibition's autofocus groups BEFORE the
    // row goes. `autofocusGroups` is a JSON column holding raw artworkIds, so
    // no foreign key reaches inside it and the cascade below cannot clean it —
    // without this, every exhibition that grouped this piece keeps a dead id
    // forever. Surgical on purpose: the group survives with its other members,
    // because losing one artwork is not a reason to lose the grouping.
    const groupedIn = await prisma.exhibition.findMany({
      where: { autofocusGroups: { not: Prisma.DbNull } },
      select: { id: true, autofocusGroups: true },
    })
    for (const ex of groupedIn) {
      const groups = ex.autofocusGroups as unknown as AutofocusGroupJson[] | null
      if (!Array.isArray(groups)) continue
      if (!groups.some((g) => Array.isArray(g?.artworkIds) && g.artworkIds.includes(id))) continue
      const cleaned = groups.map((g) => ({
        ...g,
        artworkIds: Array.isArray(g?.artworkIds)
          ? g.artworkIds.filter((aid) => aid !== id)
          : g?.artworkIds,
      }))
      await prisma.exhibition.update({
        where: { id: ex.id },
        data: { autofocusGroups: cleaned as unknown as Prisma.InputJsonValue },
      })
    }

    // Delete artwork record
    await prisma.artwork.delete({
      where: { id },
    })

    // Bust detail page cache + any exhibition pages that showed it +
    // the artist profile page that lists the artwork.
    revalidateTag(`artwork-${id}`, 'default')
    for (const { exhibition } of linkedExhibitions) {
      if (exhibition?.url) revalidateTag(`exhibition-${exhibition.url}`, 'default')
    }
    if (artwork.user?.handler) {
      revalidateTag(`artist-${artwork.user.handler}`, 'default')
    }
    revalidateTag('artists', 'default')
    revalidateTag('artworks', 'default')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete artwork' }, { status: 500 })
  }
}
