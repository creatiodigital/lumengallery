import type { ArtworkSale } from '@/lib/editions/artworkSale'

export type PrintsPageContent = {
  title: string
  content: string
  bannerImageUrl: string | null
}

export type PrintArtwork = {
  id: string
  slug: string
  title: string
  name: string
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  editionType: string
  imageUrl: string | null
  originalWidth?: number | null
  originalHeight?: number | null
  createdAt: string
  /** What the card says about buying a print — edition, price, or sold out.
   *  Resolved server-side by `resolveArtworkSale`, the same rule the artist and
   *  exhibition grids use. */
  sale?: ArtworkSale | null
  /** The bare figure, derived from `sale`. EXCLUDES shipping and tax (both
   *  destination-dependent, so unknowable on a listing). Null means nothing is
   *  purchasable — a limited edition whose variants have all sold. */
  minPriceCents?: number | null
  user: {
    id: string
    name: string | null
    lastName: string | null
    handler: string
  }
}

export type SortValue = 'date-desc' | 'date-asc'

// Numbered-pagination page size for the /prints catalog. Locked at 24 (design
// 2026-06-21). Shared by the server action (skip/take + count), the SSR'd first
// page, and the client (page-count math) so all three agree on one source.
export const PRINTS_PAGE_SIZE = 24

// Edition filter value. '' = all editions; otherwise the canonical editionType.
export type EditionFilter = '' | 'open' | 'limited'

// One entry in the artist filter dropdown. Fetched once on the server (artists
// with ≥1 print-enabled, published artwork) so it scales with artists, not works.
// `count` is how many of that artist's works currently qualify — the admin
// picker's artist list badge.
export type PrintArtistOption = { value: string; label: string; count: number }

export const displayArtist = (artwork: PrintArtwork): string => {
  if (artwork.author && artwork.author.trim()) return artwork.author.trim()
  const { name, lastName } = artwork.user
  return [name, lastName].filter(Boolean).join(' ').trim()
}
