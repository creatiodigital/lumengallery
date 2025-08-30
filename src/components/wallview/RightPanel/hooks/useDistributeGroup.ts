import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TDistributeAlign } from '@/types/wizard'

export const useDistributeGroup = (boundingData: TDimensions | null) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const distributeArtworksInGroup = (alignment: TDistributeAlign) => {
    const { groupX, groupY, groupWidth, groupHeight } = artworkGroup

    let groupedArtworks = artworkGroupIds.map((id) => exhibitionArtworksById[id]).filter(Boolean)

    if (alignment === 'horizontal') {
      groupedArtworks = groupedArtworks.sort((a, b) => a.posX2d - b.posX2d)
    } else if (alignment === 'vertical') {
      groupedArtworks = groupedArtworks.sort((a, b) => a.posY2d - b.posY2d)
    }

    const artworkTotalWidth = groupedArtworks.reduce((total, artwork) => total + artwork.width2d, 0)
    const artworkTotalHeight = groupedArtworks.reduce(
      (total, artwork) => total + artwork.height2d,
      0,
    )

    const gapsBetweenArtworks = groupedArtworks.length - 1

    // Calculate spacing only for gaps between artworks
    const horizontalSpacing =
      gapsBetweenArtworks > 0 ? (groupWidth - artworkTotalWidth) / gapsBetweenArtworks : 0
    const verticalSpacing =
      gapsBetweenArtworks > 0 ? (groupHeight - artworkTotalHeight) / gapsBetweenArtworks : 0

    // Initialize positions
    const horizontalPositions: number[] = []
    const verticalPositions: number[] = []

    if (alignment === 'horizontal') {
      let currentX = groupX // Start at the left edge of the group
      groupedArtworks.forEach((artwork) => {
        horizontalPositions.push(currentX)
        currentX += artwork.width2d + horizontalSpacing
      })
    }

    if (alignment === 'vertical') {
      let currentY = groupY // Start at the top edge of the group
      groupedArtworks.forEach((artwork) => {
        verticalPositions.push(currentY)
        currentY += artwork.height2d + verticalSpacing
      })
    }

    // Update artwork positions
    groupedArtworks.forEach((artwork, index) => {
      if (artwork) {
        let newX = artwork.posX2d
        let newY = artwork.posY2d

        switch (alignment) {
          case 'horizontal':
            newX = horizontalPositions[index]
            break
          case 'vertical':
            newY = verticalPositions[index]
            break
          default:
            break
        }

        const artworkPosition = {
          posX2d: newX,
          posY2d: newY,
        }

        if (boundingData) {
          const new3DCoordinate = convert2DTo3D(
            newX,
            newY,
            artwork.width2d,
            artwork.height2d,
            boundingData,
          )

          if (artwork?.id) {
            dispatch(
              updateArtworkPosition({
                artworkId: artwork.id,
                artworkPosition: { ...artworkPosition, ...new3DCoordinate },
              }),
            )
          }
        }
      }
    })
  }

  return {
    distributeArtworksInGroup,
  }
}
