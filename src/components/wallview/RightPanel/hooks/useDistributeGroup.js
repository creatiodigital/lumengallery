import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtworkSpace, editArtworkCanvas } from '@/lib/features/artworksSlice'

export const useDistributeGroup = (boundingData) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const artworks = useSelector((state) => state.artworks.artworks)

  const distributeArtworksInGroup = (alignment) => {
    const { groupX, groupY, groupWidth, groupHeight } = artworkGroup

    // Filter artworks in the group, maintaining the visual order
    let groupedArtworks = artworkGroupIds
      .map((id) => artworks.find((artwork) => artwork.id === id))
      .filter(Boolean) // Ensure no undefined entries

    // Sort artworks visually based on the alignment
    if (alignment === 'horizontal') {
      groupedArtworks = groupedArtworks.sort((a, b) => a.canvas.x - b.canvas.x)
    } else if (alignment === 'vertical') {
      groupedArtworks = groupedArtworks.sort((a, b) => a.canvas.y - b.canvas.y)
    }

    // Calculate total dimensions of artworks
    const artworkTotalWidth = groupedArtworks.reduce(
      (total, artwork) => total + artwork.canvas.width,
      0,
    )
    const artworkTotalHeight = groupedArtworks.reduce(
      (total, artwork) => total + artwork.canvas.height,
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
        currentX += artwork.canvas.width + horizontalSpacing
      })
    }

    if (alignment === 'vertical') {
      let currentY = groupY // Start at the top edge of the group
      groupedArtworks.forEach((artwork) => {
        verticalPositions.push(currentY)
        currentY += artwork.canvas.height + verticalSpacing
      })
    }

    // Update artwork positions
    groupedArtworks.forEach((artwork, index) => {
      if (artwork) {
        let newX = artwork.canvas.x
        let newY = artwork.canvas.y

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

        const newArtworkSizes = {
          x: newX,
          y: newY,
          width: artwork.canvas.width,
          height: artwork.canvas.height,
        }

        dispatch(
          editArtworkCanvas({ currentArtworkId: artwork.id, canvasUpdates: newArtworkSizes }),
        )

        const new3DCoordinate = convert2DTo3D(
          {
            x: newX,
            y: newY,
            size: { w: artwork.canvas.width, h: artwork.canvas.height },
          },
          boundingData,
        )

        dispatch(
          editArtworkSpace({
            currentArtworkId: artwork.id,
            spaceUpdates: new3DCoordinate,
          }),
        )
      }
    })
  }

  return {
    distributeArtworksInGroup,
  }
}
