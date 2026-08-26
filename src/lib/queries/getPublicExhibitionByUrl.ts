import type { Prisma } from '@/generated/prisma'
import { SALE_SELECT, saleFromRow, type ArtworkSale } from '@/lib/editions/artworkSale'
import prisma from '@/lib/prisma'
import { captureError } from '@/lib/observability/captureError'

/**
 * Every artwork field the public exhibition grid renders, in ONE place.
 *
 * This page loads its artworks through two different paths — the published
 * snapshot and the live relation — and they each used to spell their select
 * out. A field added to one and forgotten in the other is invisible until a
 * priced work quietly shows no price on a published exhibition, which is the
 * only kind there is. Sharing the constant makes that impossible.
 */
const PUBLIC_ARTWORK_SELECT = {
  id: true,
  slug: true,
  name: true,
  title: true,
  author: true,
  year: true,
  technique: true,
  dimensions: true,
  imageUrl: true,
  artworkType: true,
  hiddenFromExhibition: true,
  order: true,
  ...SALE_SELECT,
} satisfies Prisma.ArtworkSelect

type PublicArtworkRow = Prisma.ArtworkGetPayload<{ select: typeof PUBLIC_ARTWORK_SELECT }>

// No data cache: read straight from the DB so library reordering and artwork
// metadata edits propagate to the public exhibition page immediately. The
// page that calls this is force-dynamic. The 3D scene is still frozen via the
// exhibition's publishedSnapshot — only live metadata/order is enriched below.
const getExhibition = (url: string) =>
  prisma.exhibition.findUnique({
    where: { url },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          lastName: true,
          handler: true,
          biography: true,
        },
      },
      exhibitionArtworks: {
        include: {
          artwork: { select: PUBLIC_ARTWORK_SELECT },
        },
      },
    },
  })

export type PublicExhibitionArtwork = {
  id: string
  slug: string
  name: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  imageUrl: string | null
  originalWidth: number | null
  originalHeight: number | null
  /** What the card says about buying a print. Null = not for sale, so the card
   *  shows no commerce at all. See `resolveArtworkSale`. */
  sale: ArtworkSale | null
}

export type PublicExhibition = {
  id: string
  mainTitle: string
  shortDescription: string | null
  description: string | null
  featuredImageUrl: string | null
  url: string
  status: string
  startDate: Date | null
  endDate: Date | null
  user: {
    id: string
    name: string
    lastName: string
    handler: string
    biography: string | null
  }
  artworks: PublicExhibitionArtwork[]
}

/**
 * A live row → the card's shape. The pricing inputs are resolved into `sale`
 * and dropped: `printPriceCents` is the ARTIST's cut, not a buyer-facing
 * figure, and must not cross to the client.
 */
function toPublicArtwork(row: PublicArtworkRow): PublicExhibitionArtwork {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    title: row.title,
    author: row.author,
    year: row.year,
    technique: row.technique,
    dimensions: row.dimensions,
    imageUrl: row.imageUrl,
    originalWidth: row.originalWidth,
    originalHeight: row.originalHeight,
    sale: saleFromRow(row),
  }
}

/**
 * Reads a published exhibition for the public profile page. Returns
 * `null` for missing or unpublished exhibitions so callers can map to
 * a 404 at the route boundary.
 *
 * Mirrors the snapshot reconciliation done in /api/exhibitions/by-url:
 * when an exhibition has a `publishedSnapshot`, the curated artwork set
 * comes from the snapshot, then each artwork is enriched with live DB
 * metadata so edits to title/dimensions/etc. show up without a republish.
 * 3D scene fields in the snapshot are not part of this profile shape —
 * they're only consumed by the /visit route.
 */
export async function getPublicExhibitionByUrl(url: string): Promise<PublicExhibition | null> {
  // Report DB/read failures with flow context — they'd otherwise bubble to the
  // Next error boundary (a 500 page) with no operator signal. Re-throw so the
  // route's existing notFound/error handling is unchanged. (Observability
  // hardening for launch — see project_observability_instrumentation_map.)
  try {
    return await loadPublicExhibition(url)
  } catch (error) {
    captureError(error, {
      flow: 'content',
      stage: 'get-public-exhibition',
      level: 'error',
      fingerprint: ['content:get-public-exhibition-failed'],
      extra: { url },
    })
    throw error
  }
}

async function loadPublicExhibition(url: string): Promise<PublicExhibition | null> {
  const exhibition = await getExhibition(url)
  if (!exhibition || !exhibition.published) return null

  const snapshot = exhibition.publishedSnapshot as Record<string, unknown> | null
  let artworks: PublicExhibitionArtwork[] = []

  if (snapshot) {
    const snapshotArtworks = (snapshot.artworks as Array<Record<string, unknown>>) || []
    const snapshotArtworkObjects = snapshotArtworks
      .map((ea) => ea.artwork as Record<string, unknown>)
      .filter((artwork) => !artwork?.hiddenFromExhibition && artwork?.artworkType === 'image')

    const ids = snapshotArtworkObjects.map((a) => a.id as string).filter(Boolean)
    const live = await prisma.artwork.findMany({
      where: { id: { in: ids } },
      select: PUBLIC_ARTWORK_SELECT,
    })
    const liveById = Object.fromEntries(live.map((a) => [a.id, a]))

    artworks = snapshotArtworkObjects
      .map((artwork) => {
        const liveArtwork = liveById[artwork.id as string]
        // The artwork is gone from the library — the snapshot is all that is
        // left of it. Frozen metadata can be shown; a price cannot, because
        // there is no live row to price and nothing to sell.
        if (!liveArtwork) {
          return {
            id: artwork.id as string,
            slug: artwork.slug as string,
            name: artwork.name as string,
            title: (artwork.title as string) ?? null,
            author: (artwork.author as string) ?? null,
            year: (artwork.year as string) ?? null,
            technique: (artwork.technique as string) ?? null,
            dimensions: (artwork.dimensions as string) ?? null,
            imageUrl: (artwork.imageUrl as string) ?? null,
            originalWidth: (artwork.originalWidth as number) ?? null,
            originalHeight: (artwork.originalHeight as number) ?? null,
            sale: null,
          }
        }
        return toPublicArtwork(liveArtwork)
      })
      .filter((artwork) => {
        const liveArtwork = liveById[artwork.id]
        return !liveArtwork?.hiddenFromExhibition
      })
      // Sort by the artist's library order so reordering in the dashboard
      // propagates here without needing to republish the snapshot. Items
      // no longer in the live DB sink to the bottom.
      .sort(
        (a, b) =>
          (liveById[a.id]?.order ?? Number.POSITIVE_INFINITY) -
          (liveById[b.id]?.order ?? Number.POSITIVE_INFINITY),
      )
  } else {
    artworks = exhibition.exhibitionArtworks
      .map((ea) => ea.artwork)
      .filter((a) => !a.hiddenFromExhibition && a.artworkType === 'image')
      .sort((a, b) => a.order - b.order)
      .map(toPublicArtwork)
  }

  return {
    id: exhibition.id,
    mainTitle: exhibition.mainTitle,
    shortDescription: exhibition.shortDescription,
    description: exhibition.description,
    featuredImageUrl: exhibition.featuredImageUrl,
    url: exhibition.url,
    status: exhibition.status,
    startDate: exhibition.startDate,
    endDate: exhibition.endDate,
    user: exhibition.user,
    artworks,
  }
}
