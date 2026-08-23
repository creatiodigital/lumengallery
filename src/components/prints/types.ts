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
  /** Cheapest configuration a buyer can actually complete, in cents, EXCLUDING
   *  shipping and tax (both destination-dependent, so unknowable on a
   *  listing). Null means nothing is purchasable — a limited edition whose
   *  variants have all sold. See lib/editions/minimumPrice. */
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
export type PrintArtistOption = { value: string; label: string }

export const displayArtist = (artwork: PrintArtwork): string => {
  if (artwork.author && artwork.author.trim()) return artwork.author.trim()
  const { name, lastName } = artwork.user
  return [name, lastName].filter(Boolean).join(' ').trim()
}
