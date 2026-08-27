import prisma from '@/lib/prisma'

import type { ArtworkMediaItem } from './artworkMediaTypes'

// Re-exported so server callers keep a single import, while client components
// take the same names from `artworkMediaTypes` and never reach Prisma.
export {
  MAX_ARTWORK_MEDIA,
  MAX_ARTWORK_MEDIA_VIDEOS,
  type ArtworkMediaItem,
} from './artworkMediaTypes'

/**
 * Ordered media for one artwork. `order` first, then insertion time so a batch
 * uploaded at the same position keeps a stable, predictable sequence rather
 * than shuffling between requests.
 */
export async function getArtworkMedia(artworkId: string): Promise<ArtworkMediaItem[]> {
  const rows = await prisma.artworkMedia.findMany({
    where: { artworkId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, kind: true, url: true, width: true, height: true, caption: true },
  })

  // `kind` is a string column; anything unrecognised is dropped rather than
  // rendered as a broken element.
  return rows.flatMap((r) =>
    r.kind === 'image' || r.kind === 'video' ? [{ ...r, kind: r.kind as 'image' | 'video' }] : [],
  )
}
