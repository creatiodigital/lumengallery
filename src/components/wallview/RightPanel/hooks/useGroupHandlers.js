import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D, convert2DTo3DE } from '@/components/wallview/utils'
import { editArtworkSpace, editArtworkCanvas } from '@/lib/features/artworksSlice'
import { editArtworkGroup } from '@/lib/features/wallViewSlice'

import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'

export const useGroupHandlers = (artworkGroupIds, boundingData) => {
  const dispatch = useDispatch()
  const artworksById = useSelector((state) => state.artworks.byId)
  const artworksByIdE = useSelector((state) => state.exhibition.artworksById)

  const wallHeight = useSelector((state) => state.wallView.wallHeight)
  const wallWidth = useSelector((state) => state.wallView.wallWidth)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)

  const handleMoveGroupXChange = (e) => {
    const newGroupX = e.target.value * 100
    const deltaX = newGroupX - artworkGroup.groupX

    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: artworkGroup.groupY }))

    artworkGroupIds.forEach((artworkId) => {
      const artwork = artworksById[artworkId]
      const artworkE = artworksByIdE[artwrokId]

      if (artwork) {
        const newArtworkCanvas = {
          x: artwork.canvas.x + deltaX,
          y: artwork.canvas.y,
          width: artwork.canvas.width,
          height: artwork.canvas.height,
          posX2d: artworkE.posX2d,
          posY2d: artworkE.posY2d,
          width2d: artworkE.width2d,
          height2d: artworkE.height2d,
        }

        dispatch(
          editArtworkCanvas({ currentArtworkId: artworkId, canvasUpdates: newArtworkCanvas }),
        )

        if (boundingData) {
          const new3DCoordinate = convert2DTo3D(
            {
              x: newArtworkCanvas.x,
              y: newArtworkCanvas.y,
              size: { w: newArtworkCanvas.width, h: newArtworkCanvas.height },
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

        //NEW WAY
        const artworkPositionE = {
          posX2d: artwork.canvas.x + deltaX,
          posY2d: artwork.canvas.y,
          width2D: artwork.canvas.width,
          height3D: artwork.canvas.height,
        }

        const new3DCoordinateE = convert2DTo3DE(
          {
            x: newArtworkCanvas.x, //UPDATE THIS
            y: newArtworkCanvas.y, //UPDATE THIS
            size: { w: newArtworkCanvas.width, h: newArtworkCanvas.height },
          },
          boundingData,
        )

        // REFACTOR THIS SO WE SEND 2D and 3D at the same time
        dispatch(
          updateArtworkPosition({
            artworkId: draggedArtworkId,
            artworkPosition: { ...artworkPositionE, ...new3DCoordinateE },
          }),
        )
      }
    })
  }

  const handleMoveGroupYChange = (e) => {
    const newGroupY = e.target.value * 100
    const deltaY = newGroupY - artworkGroup.groupY

    dispatch(editArtworkGroup({ groupX: artworkGroup.groupX, groupY: newGroupY }))

    artworkGroupIds.forEach((artworkId) => {
      const artwork = artworksById[artworkId]

      if (artwork) {
        const newArtworkCanvas = {
          x: artwork.canvas.x,
          y: artwork.canvas.y + deltaY,
          width: artwork.canvas.width,
          height: artwork.canvas.height,
        }

        dispatch(
          editArtworkCanvas({ currentArtworkId: artworkId, canvasUpdates: newArtworkCanvas }),
        )

        if (boundingData) {
          const new3DCoordinate = convert2DTo3D(
            {
              x: newArtworkCanvas.x,
              y: newArtworkCanvas.y,
              size: { w: newArtworkCanvas.width, h: newArtworkCanvas.height },
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
      }
    })
  }

  const alignGroupToWall = (alignment) => {
    let newGroupX = artworkGroup.groupX
    let newGroupY = artworkGroup.groupY

    switch (alignment) {
      case 'verticalTop':
        newGroupY = 0
        break
      case 'verticalCenter':
        newGroupY = (wallHeight * 100) / 2 - artworkGroup.groupHeight / 2
        break
      case 'verticalBottom':
        newGroupY = wallHeight * 100 - artworkGroup.groupHeight
        break
      case 'horizontalLeft':
        newGroupX = 0
        break
      case 'horizontalCenter':
        newGroupX = (wallWidth * 100) / 2 - artworkGroup.groupWidth / 2
        break
      case 'horizontalRight':
        newGroupX = wallWidth * 100 - artworkGroup.groupWidth
        break
      default:
        console.warn('Invalid alignment type:', alignment)
        return
    }

    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: newGroupY }))

    const deltaX = newGroupX - artworkGroup.groupX
    const deltaY = newGroupY - artworkGroup.groupY

    artworkGroupIds.forEach((artworkId) => {
      const artwork = artworksById[artworkId]

      if (artwork) {
        const newArtworkCanvas = {
          x: artwork.canvas.x + deltaX,
          y: artwork.canvas.y + deltaY,
          width: artwork.canvas.width,
          height: artwork.canvas.height,
        }

        dispatch(
          editArtworkCanvas({ currentArtworkId: artworkId, canvasUpdates: newArtworkCanvas }),
        )

        if (boundingData) {
          const new3DCoordinate = convert2DTo3D(
            {
              x: newArtworkCanvas.x,
              y: newArtworkCanvas.y,
              size: { w: newArtworkCanvas.width, h: newArtworkCanvas.height },
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
      }
    })
  }

  return {
    handleMoveGroupXChange,
    handleMoveGroupYChange,
    alignGroupToWall,
  }
}
