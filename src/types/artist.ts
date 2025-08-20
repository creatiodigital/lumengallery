import type { Exhibition } from './exhibition'

export type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
}

export type ArtistState = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  exhibitionsById: Record<string, Exhibition>
  allExhibitionIds: string[]
}
