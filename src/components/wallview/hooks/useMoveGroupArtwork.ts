import React, { useState, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import {
  editArtworkGroup,
  startDraggingGroup,
  stopDraggingGroup,
} from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'

export const useMoveGroupArtwork = (
  wallRef: RefObject<HTMLDivElement | null>,
  boundingData: TDimensions | null,
  scaleFactor: number,
  preventClick: React.RefObject<boolean>,
) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const [isDraggingGroup, setIsDraggingGroup] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleGroupDragStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!wallRef.current || !artworkGroup) return

      const rect = wallRef.current.getBoundingClientRect()
      const offsetX = (event.clientX - rect.left) / scaleFactor - (artworkGroup.groupX ?? 0)
      const offsetY = (event.clientY - rect.top) / scaleFactor - (artworkGroup.groupY ?? 0)

      setOffset({ x: offsetX, y: offsetY })
      setIsDraggingGroup(true)
      dispatch(startDraggingGroup())
      preventClick.current = true
    },
    [wallRef, scaleFactor, artworkGroup, dispatch, preventClick],
  )

  const handleGroupDragMove = useCallback(
    (event: MouseEvent) => {
      if (!isDraggingGroup || !wallRef.current || !boundingData || !artworkGroup) return

      const rect = wallRef.current.getBoundingClientRect()
      const scaledMouseX = (event.clientX - rect.left) / scaleFactor
      const scaledMouseY = (event.clientY - rect.top) / scaleFactor

      const x = scaledMouseX - offset.x
      const y = scaledMouseY - offset.y

      const deltaX = x - (artworkGroup.groupX ?? 0)
      const deltaY = y - (artworkGroup.groupY ?? 0)

      dispatch(editArtworkGroup({ groupX: x, groupY: y }))

      artworkGroupIds.forEach((artworkId) => {
        const artwork = exhibitionArtworksById[artworkId]
        if (!artwork) return

        const posX2d = artwork.posX2d + deltaX
        const posY2d = artwork.posY2d + deltaY
        const width2d = artwork.width2d
        const height2d = artwork.height2d

        const new3DCoordinate = convert2DTo3D(posX2d, posY2d, width2d, height2d, boundingData)

        dispatch(
          updateArtworkPosition({
            artworkId,
            artworkPosition: { posX2d, posY2d, width2d, height2d, ...new3DCoordinate },
          }),
        )
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
      exhibitionArtworksById,
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
      const moveHandler = (event: MouseEvent) => handleGroupDragMove(event)
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
    handleGroupDragEnd,
  }
}
