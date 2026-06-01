import prisma from '@/lib/prisma'

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
          artwork: {
            select: {
              id: true,
              slug: true,
              name: true,
              title: true,
              author: true,
              year: true,
              technique: true,
              dimensions: true,
              imageUrl: true,
              originalWidth: true,
              originalHeight: true,
              artworkType: true,
              hiddenFromExhibition: true,
              order: true,
            },
          },
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
      select: {
        id: true,
        slug: true,
        name: true,
        title: true,
        author: true,
        year: true,
        technique: true,
        dimensions: true,
        imageUrl: true,
        originalWidth: true,
        originalHeight: true,
        hiddenFromExhibition: true,
        order: true,
      },
    })
    const liveById = Object.fromEntries(live.map((a) => [a.id, a]))

    artworks = snapshotArtworkObjects
      .map((artwork) => {
        const liveArtwork = liveById[artwork.id as string]
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
          }
        }
        return {
          id: liveArtwork.id,
          slug: liveArtwork.slug,
          name: liveArtwork.name,
          title: liveArtwork.title,
          author: liveArtwork.author,
          year: liveArtwork.year,
          technique: liveArtwork.technique,
          dimensions: liveArtwork.dimensions,
          imageUrl: liveArtwork.imageUrl,
          originalWidth: liveArtwork.originalWidth,
          originalHeight: liveArtwork.originalHeight,
        }
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
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        title: a.title,
        author: a.author,
        year: a.year,
        technique: a.technique,
        dimensions: a.dimensions,
        imageUrl: a.imageUrl,
        originalWidth: a.originalWidth,
        originalHeight: a.originalHeight,
      }))
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
