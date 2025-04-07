import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtworkSpace, editArtworkCanvas } from '@/lib/features/artworksSlice'
import { editArtworkGroup } from '@/lib/features/wallViewSlice'

export const useGroupHandlers = (artworkGroupIds, boundingData) => {
  const dispatch = useDispatch()
  const artworksById = useSelector((state) => state.artworks.byId)

  const wallHeight = useSelector((state) => state.wallView.wallHeight)
  const wallWidth = useSelector((state) => state.wallView.wallWidth)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)

  const handleMoveGroupXChange = (e) => {
    const newGroupX = e.target.value * 100
    const deltaX = newGroupX - artworkGroup.groupX

    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: artworkGroup.groupY }))

    artworkGroupIds.forEach((artworkId) => {
      const artwork = artworksById[artworkId]

      if (artwork) {
        const newArtworkCanvas = {
          x: artwork.canvas.x + deltaX,
          y: artwork.canvas.y,
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
