import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'

export const useDistributeGroup = (boundingData) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const exhibitionArtworksById = useSelector((state) => state.exhibition.exhibitionArtworksById)

  const distributeArtworksInGroup = (alignment) => {
    const { groupX, groupY, groupWidth, groupHeight } = artworkGroup

    // Filter artworks in the group, maintaining the visual order
    let groupedArtworks = artworkGroupIds.map((id) => exhibitionArtworksById[id]).filter(Boolean)

    // Sort artworks visually based on the alignment
    if (alignment === 'horizontal') {
      groupedArtworks = groupedArtworks.sort((a, b) => a.posX2d - b.posX2d)
    } else if (alignment === 'vertical') {
      groupedArtworks = groupedArtworks.sort((a, b) => a.posY2d - b.posY2d)
    }

    // Calculate total dimensions of artworks
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
    const horizontalPositions = []
    const verticalPositions = []

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

        const new3DCoordinate = convert2DTo3D(
          newX,
          newY,
          artwork.width2d,
          artwork.height2d,
          boundingData,
        )

        dispatch(
          updateArtworkPosition({
            artworkId: artwork.id,
            artworkPosition: { ...artworkPosition, ...new3DCoordinate },
          }),
        )
      }
    })
  }

  return {
    distributeArtworksInGroup,
  }
}
