import type { ExhibitionType } from '@/types/exhibition'

export const exhibitionFactory = (): ExhibitionType => ({
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
