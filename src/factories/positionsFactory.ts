import type { TArtworkPosition } from '@/types/artwork'

export const createNewArtworkPosition = ({
  artworkId,
  wallId,
}: {
  artworkId: string
  wallId: string
}): TArtworkPosition => ({
  artworkId,
  wallId,
  posX2d: 0,
  posY2d: 0,
  posX3d: 0,
  posY3d: 0,
  posZ3d: 0,
  width2d: 100,
  height2d: 100,
  quaternionX: 0,
  quaternionY: 0,
  quaternionZ: 0,
  quaternionW: 1,
})
