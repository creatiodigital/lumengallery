import { useState, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtwork, edit3DCoordinates } from '@/lib/features/artistSlice'
import {
  editArtworkGroup,
  startDraggingGroup,
  stopDraggingGroup,
} from '@/lib/features/wallViewSlice'

export const useMoveGroupArtwork = (wallRef, boundingData, scaleFactor, preventClick) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const artworks = useSelector((state) => state.artist.artworks)
  const [isDraggingGroup, setIsDraggingGroup] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleGroupDragStart = useCallback(
    (event) => {
      if (!wallRef.current || !artworkGroup) return

      const rect = wallRef.current.getBoundingClientRect()
      const offsetX = (event.clientX - rect.left) / scaleFactor - artworkGroup.groupX
      const offsetY = (event.clientY - rect.top) / scaleFactor - artworkGroup.groupY

      setOffset({ x: offsetX, y: offsetY })
      setIsDraggingGroup(true)
      dispatch(startDraggingGroup())
      preventClick.current = true
    },
    [wallRef, scaleFactor, artworkGroup, dispatch, preventClick],
  )

  const handleGroupDragMove = useCallback(
    (event) => {
      if (!isDraggingGroup || !wallRef.current || !boundingData || !artworkGroup) return

      const rect = wallRef.current.getBoundingClientRect()
      const scaledMouseX = (event.clientX - rect.left) / scaleFactor
      const scaledMouseY = (event.clientY - rect.top) / scaleFactor

      const x = scaledMouseX - offset.x
      const y = scaledMouseY - offset.y

      const deltaX = x - artworkGroup.groupX
      const deltaY = y - artworkGroup.groupY

      dispatch(
        editArtworkGroup({
          groupX: x,
          groupY: y,
        }),
      )

      artworkGroupIds.forEach((artworkId) => {
        const artwork = artworks.find((art) => art.id === artworkId)
        if (artwork) {
          const updatedCanvas = {
            x: artwork.canvas.x + deltaX,
            y: artwork.canvas.y + deltaY,
            width: artwork.canvas.width,
            height: artwork.canvas.height,
          }

          dispatch(
            editArtwork({
              currentArtworkId: artworkId,
              newArtworkSizes: updatedCanvas,
            }),
          )

          const new3DCoordinate = convert2DTo3D(
            {
              x: updatedCanvas.x,
              y: updatedCanvas.y,
              size: { w: updatedCanvas.width, h: updatedCanvas.height },
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
    [
      isDraggingGroup,
      wallRef,
      boundingData,
      scaleFactor,
      offset,
      artworkGroup,
      artworkGroupIds,
      artworks,
      dispatch,
    ],
  )

  const handleGroupDragEnd = useCallback(() => {
    setIsDraggingGroup(false)
    dispatch(stopDraggingGroup())
    setTimeout(() => {
      preventClick.current = false
    }, 100)
  }, [dispatch, preventClick])

  useEffect(() => {
    if (isDraggingGroup) {
      const moveHandler = (event) => handleGroupDragMove(event)
      const upHandler = () => handleGroupDragEnd()

      document.addEventListener('mousemove', moveHandler)
      document.addEventListener('mouseup', upHandler)

      return () => {
        document.removeEventListener('mousemove', moveHandler)
        document.removeEventListener('mouseup', upHandler)
      }
    }
  }, [isDraggingGroup, handleGroupDragMove, handleGroupDragEnd])

  return {
    handleGroupDragStart,
    handleGroupDragMove,
    handleGroupDragEnd,
  }
}
