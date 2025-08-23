import type { ExhibitionType } from './exhibition'

export type ArtistType = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  userType: string
  email: string
}

export type ArtistStateType = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  exhibitionsById: Record<string, ExhibitionType>
  allExhibitionIds: string[]
}
