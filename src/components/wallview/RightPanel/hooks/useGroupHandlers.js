import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { edit3DCoordinates, editArtwork } from '@/lib/features/artistSlice'
import { editArtworkGroup } from '@/lib/features/wallViewSlice'

export const useGroupHandlers = (artworkGroupIds, boundingData) => {
  const dispatch = useDispatch()
  const artworks = useSelector((state) => state.artist.artworks)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)

  const handleMoveGroupXChange = (e) => {
    const newGroupX = e.target.value * 100
    const deltaX = newGroupX - artworkGroup.groupX

    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: artworkGroup.groupY }))

    artworkGroupIds.forEach((artworkId) => {
      const artwork = artworks.find((art) => art.id === artworkId)

      if (artwork) {
        const newArtworkCanvas = {
          x: artwork.canvas.x + deltaX,
          y: artwork.canvas.y,
          width: artwork.canvas.width,
          height: artwork.canvas.height,
        }

        dispatch(editArtwork({ currentArtworkId: artworkId, newArtworkSizes: newArtworkCanvas }))

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
            edit3DCoordinates({
              currentArtworkId: artworkId,
              serialized3DCoordinate: new3DCoordinate,
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
      const artwork = artworks.find((art) => art.id === artworkId)

      if (artwork) {
        const newArtworkCanvas = {
          x: artwork.canvas.x,
          y: artwork.canvas.y + deltaY,
          width: artwork.canvas.width,
          height: artwork.canvas.height,
        }

        dispatch(editArtwork({ currentArtworkId: artworkId, newArtworkSizes: newArtworkCanvas }))

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
            edit3DCoordinates({
              currentArtworkId: artworkId,
              serialized3DCoordinate: new3DCoordinate,
            }),
          )
        }
      }
    })
  }

  return {
    handleMoveGroupXChange,
    handleMoveGroupYChange,
  }
}
