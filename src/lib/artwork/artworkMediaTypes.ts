/**
 * Shape and limits for supplementary artwork media.
 *
 * Deliberately free of any database import so CLIENT components can use it. Its
 * sibling `artworkMedia.ts` imports Prisma for the query, and a client
 * component reaching for a constant there pulled the server client into the
 * browser bundle — the page died on `POSTGRES_PRISMA_URL is required` at module
 * evaluation. Types alone would have been erased; a `const` is not.
 */

export type ArtworkMediaItem = {
  id: string
  kind: 'image' | 'video'
  url: string
  width: number | null
  height: number | null
  /** Plain text, escaped on render. Never HTML. */
  caption: string | null
}

/**
 * A SAFETY ceiling, not a design limit. The gallery adds assets freely and the
 * page is built to take as many as it is given; this exists only so a careless
 * or compromised account cannot fill the bucket. Set far above any real work —
 * if it is ever reached in earnest, raise it rather than treating it as a rule.
 */
export const MAX_ARTWORK_MEDIA = 60

/** Autoplaying more than a couple of videos on one page is a bandwidth problem
 *  for the buyer, not a feature. */
export const MAX_ARTWORK_MEDIA_VIDEOS = 2
