import { useState, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import {
  editArtworkGroup,
  startDraggingGroup,
  stopDraggingGroup,
} from '@/lib/features/wallViewSlice'

import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'

export const useMoveGroupArtwork = (wallRef, boundingData, scaleFactor, preventClick) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)

  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const positionsById = useSelector((state) => state.exhibition.positionsById)

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
        const artwork = positionsById[artworkId]
        if (artwork) {
          const posX2d = artwork.posX2d + deltaX
          const posY2d = artwork.posY2d + deltaY
          const width2d = artwork.width2d
          const height2d = artwork.height2d

          const artworkPosition = {
            posX2d,
            posY2d,
            width2d,
            height2d,
          }

          const new3DCoordinate = convert2DTo3D(posX2d, posY2d, width2d, height2d, boundingData)

          dispatch(
            updateArtworkPosition({
              artworkId,
              artworkPosition: { ...artworkPosition, ...new3DCoordinate },
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
      positionsById,
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
