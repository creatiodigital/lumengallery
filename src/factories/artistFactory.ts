import type { ArtistStateType } from '@/types/artist'

export const createArtistState = (): ArtistStateType => ({
  id: '',
  name: '',
  lastName: '',
  handler: '',
  biography: '',
  status: 'idle',
  error: null,
  exhibitionsById: {},
  allExhibitionIds: [],
})
