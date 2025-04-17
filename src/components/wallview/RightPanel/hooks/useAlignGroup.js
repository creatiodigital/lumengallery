import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D, convert2DTo3DE } from '@/components/wallview/utils'
import { editArtworkSpace, editArtworkCanvas } from '@/lib/features/artworksSlice'
import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'

export const useAlignGroup = (boundingData) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const artworksById = useSelector((state) => state.artworks.byId)
  const artworksByIdE = useSelector((state) => state.exhibition.artworksById)

  const alignArtworksInGroup = (alignment) => {
    const { groupX, groupY, groupWidth, groupHeight } = artworkGroup

    artworkGroupIds.forEach((artworkId) => {
      const artwork = artworksById[artworkId]
      const artworkE = artworksByIdE[artworkId]

      if (artwork) {
        const artworkWidth = artwork.canvas.width
        const artworkHeight = artwork.canvas.height
        const artworkX = artwork.canvas.x
        const artworkY = artwork.canvas.y
        const posX2d = artworkE.posX2d
        const posY2d = artworkE.posY2d
        const width2d = artworkE.width2d
        const height2d = artworkE.height2d

        let newX = artworkX || posX2d // CLEAN THIS
        let newY = artworkY || posY2d // CLEAN THIS

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

        //NEW WAY
        const artworkPositionE = {
          posX2d: newX,
          posY2d: newY,
          width2d,
          height2d,
        }

        const new3DCoordinateE = convert2DTo3DE(
          {
            x: newX,
            y: newY,
            size: {
              w: width2d,
              h: height2d,
            },
          },
          boundingData,
        )

        // REFACTOR THIS SO WE SEND 2D and 3D at the same time
        dispatch(
          updateArtworkPosition({
            artworkId,
            artworkPosition: { ...artworkPositionE, ...new3DCoordinateE },
          }),
        )
      }
    })
  }

  return {
    alignArtworksInGroup,
  }
}
