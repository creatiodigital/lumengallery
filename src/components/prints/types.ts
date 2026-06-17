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
  imageUrl: string | null
  originalWidth?: number | null
  originalHeight?: number | null
  createdAt: string
  user: {
    id: string
    name: string | null
    lastName: string | null
    handler: string
  }
}

export type SortValue = 'date-desc' | 'date-asc'

export const displayArtist = (artwork: PrintArtwork): string => {
  if (artwork.author && artwork.author.trim()) return artwork.author.trim()
  const { name, lastName } = artwork.user
  return [name, lastName].filter(Boolean).join(' ').trim()
}
