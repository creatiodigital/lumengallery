import type { ArtworkPositionType } from '@/types/artwork'

export type ExhibitionType = {
  id: string
  userId: string
  name: string
  mainTitle: string
  url: string
  thumbnailUrl: string
  spaceId: string
  bannerUrl: string
  startDate: string
  endDate: string
  exhibitionArtworksById: Record<string, ArtworkPositionType>
  allExhibitionArtworkIds: string[]
  status: string
  visibility: string
}
