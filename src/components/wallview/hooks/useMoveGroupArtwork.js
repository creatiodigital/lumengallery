import { useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtwork, edit3DCoordinates } from '@/lib/features/artistSlice'
import {
  editArtworkGroup,
  startDraggingGroup,
  stopDraggingGroup,
  chooseCurrentArtworkId,
} from '@/lib/features/wallViewSlice'

export const useMoveGroupArtwork = (wallRef, boundingData, scaleFactor, preventClick) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const artworks = useSelector((state) => state.artist.artworks)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleGroupDragStart = useCallback(
    (event) => {
      if (!wallRef.current) return

      dispatch(chooseCurrentArtworkId(null))

      const rect = wallRef.current.getBoundingClientRect()
      const offsetX = (event.clientX - rect.left) / scaleFactor - artworkGroup.groupX
      const offsetY = (event.clientY - rect.top) / scaleFactor - artworkGroup.groupY

      setOffset({ x: offsetX, y: offsetY })

      dispatch(startDraggingGroup())

      preventClick.current = true
    },
    [wallRef, scaleFactor, artworkGroup, dispatch, preventClick],
  )

  const handleGroupDragMove = useCallback(
    (event) => {
      if (!wallRef.current || !boundingData) return

      const rect = wallRef.current.getBoundingClientRect()
      const scaledMouseX = (event.clientX - rect.left) / scaleFactor
      const scaledMouseY = (event.clientY - rect.top) / scaleFactor

      let x = scaledMouseX - offset.x
      let y = scaledMouseY - offset.y

      const deltaX = x - artworkGroup.groupX // Change in X position
      const deltaY = y - artworkGroup.groupY

      const artworkGroupProps = {
        groupX: x,
        groupY: y,
      }

      dispatch(editArtworkGroup(artworkGroupProps))

      artworkGroupIds.forEach((artworkId) => {
        const artwork = artworks.find((art) => art.id === artworkId)

        if (artwork) {
          const newArtworkCanvas = {
            x: artwork.canvas.x + deltaX,
            y: artwork.canvas.y + deltaY,
            width: artwork.canvas.width,
            height: artwork.canvas.height,
          }

          dispatch(
            editArtwork({
              currentArtworkId: artworkId,
              newArtworkSizes: newArtworkCanvas,
            }),
          )

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
      })
    },
    [wallRef, boundingData, scaleFactor, offset, artworkGroup, artworkGroupIds, artworks, dispatch],
  )

  const handleGroupDragEnd = useCallback(() => {
    dispatch(stopDraggingGroup())

    setTimeout(() => {
      preventClick.current = false
    }, 100)
  }, [dispatch])

  return {
    handleGroupDragStart,
    handleGroupDragMove,
    handleGroupDragEnd,
  }
}
