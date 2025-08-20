import type { ArtworkPosition } from '@/types/artwork'

export type Exhibition = {
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
  exhibitionArtworksById: Record<string, ArtworkPosition>
  allExhibitionArtworkIds: string[]
  status: string
  visibility: string
}
