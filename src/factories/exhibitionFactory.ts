import type { TExhibition } from '@/types/exhibition'

export const exhibitionFactory = (): TExhibition => ({
  id: '',
  userId: '',
  name: '',
  mainTitle: '',
  url: '',
  thumbnailUrl: '',
  spaceId: '',
  bannerUrl: '',
  startDate: '',
  endDate: '',
  exhibitionArtworksById: {},
  allExhibitionArtworkIds: [],
  status: '',
  visibility: '',
})
