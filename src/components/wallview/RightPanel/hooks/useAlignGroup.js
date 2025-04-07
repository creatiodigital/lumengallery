import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtworkSpace, editArtworkCanvas } from '@/lib/features/artworksSlice'

export const useAlignGroup = (boundingData) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const artworks = useSelector((state) => state.artworks.artworks)

  const alignArtworksInGroup = (alignment) => {
    const { groupX, groupY, groupWidth, groupHeight } = artworkGroup

    artworkGroupIds.forEach((artworkId) => {
      const artwork = artworks.find((art) => art.id === artworkId)

      if (artwork) {
        const artworkWidth = artwork.canvas.width
        const artworkHeight = artwork.canvas.height
        const artworkX = artwork.canvas.x
        const artworkY = artwork.canvas.y

        let newX = artworkX
        let newY = artworkY

        switch (alignment) {
          case 'verticalTop':
            newY = groupY
            break
          case 'verticalCenter':
            newY = groupY + groupHeight / 2 - artwork.canvas.height / 2
            break
          case 'verticalBottom':
            newY = groupY + groupHeight - artwork.canvas.height
            break
          case 'horizontalLeft':
            newX = groupX
            break
          case 'horizontalCenter':
            newX = groupX + groupWidth / 2 - artwork.canvas.width / 2
            break
          case 'horizontalRight':
            newX = groupX + groupWidth - artwork.canvas.width
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
            size: { w: artworkWidth, h: artworkHeight },
          },
          boundingData,
        )

        dispatch(
          editArtworkSpace({
            currentArtworkId: artworkId,
            spaceUpdates: new3DCoordinate,
          }),
        )
      }
    })
  }

  return {
    alignArtworksInGroup,
  }
}
