import type { Exhibition } from '@/types/exhibition'

export const exhibitionFactory = (): Exhibition => ({
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
