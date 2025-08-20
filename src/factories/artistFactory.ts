import type { ArtistState } from '@/types/artist'

export const createArtistState = (): ArtistState => ({
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
