import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import {
  setAlignedPairs,
  startDragging,
  stopDragging,
  chooseCurrentArtworkId,
} from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'

import { areAligned } from './helpers'

type TOffset = { x: number; y: number }

type TAlignmentPair = {
  from: string | null
  to: string | undefined
  direction: string
}

export const useMoveArtwork = (
  wallRef: RefObject<HTMLDivElement>,
  boundingData: TDimensions | null,
  scaleFactor: number,
) => {
  const [draggedArtworkId, setDraggedArtworkId] = useState<string | null>(null)
  const [offset, setOffset] = useState<TOffset>({ x: 0, y: 0 })

  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const allExhibitionArtworkIds = useSelector(
    (state: RootState) => state.exhibition.allExhibitionArtworkIds,
  )
  const isEditingArtwork = useSelector((state: RootState) => state.dashboard.isEditingArtwork)
  const isDragging = useSelector((state: RootState) => state.wallView.isDragging)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const dispatch = useDispatch()

  const isArtworkVisible = artworkGroupIds.length > 1

  const handleArtworkDragStart = useCallback(
    (event: MouseEvent, artworkId: string) => {
      if (isEditingArtwork || !wallRef.current || isArtworkVisible) return

      event.stopPropagation()

      const rect = wallRef.current.getBoundingClientRect()
      const artwork = exhibitionArtworksById[artworkId]
      if (!artwork) return

      const offsetX = (event.clientX - rect.left) / scaleFactor - artwork.posX2d
      const offsetY = (event.clientY - rect.top) / scaleFactor - artwork.posY2d
      setOffset({ x: offsetX, y: offsetY })

      dispatch(startDragging())
      setDraggedArtworkId(artworkId)
      dispatch(chooseCurrentArtworkId(artworkId))
    },
    [isEditingArtwork, wallRef, isArtworkVisible, exhibitionArtworksById, scaleFactor, dispatch],
  )

  const handleArtworkDragMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging || !draggedArtworkId || !boundingData || !wallRef.current) return

      event.preventDefault()
      event.stopPropagation()

      const rect = wallRef.current.getBoundingClientRect()
      const scaledMouseX = (event.clientX - rect.left) / scaleFactor
      const scaledMouseY = (event.clientY - rect.top) / scaleFactor

      let x = scaledMouseX - offset.x
      let y = scaledMouseY - offset.y

      const artwork = exhibitionArtworksById[draggedArtworkId]
      if (!artwork) return

      const sameWallArtworks = allExhibitionArtworkIds
        .filter(
          (id) => id !== draggedArtworkId && exhibitionArtworksById[id].wallId === currentWallId,
        )
        .map((id) => exhibitionArtworksById[id])

      let snapX = x
      let snapY = y

      const alignedPairs: TAlignmentPair[] = []

      sameWallArtworks.forEach((otherArtwork) => {
        const alignment = areAligned(
          { x: snapX, y: snapY, width: artwork.width2d, height: artwork.height2d },
          {
            x: otherArtwork.posX2d,
            y: otherArtwork.posY2d,
            width: otherArtwork.width2d,
            height: otherArtwork.height2d,
          },
        )

        if (alignment.horizontal) {
          if (alignment.horizontal === 'top') {
            snapY = otherArtwork.posY2d
          }
          if (alignment.horizontal === 'bottom') {
            snapY = otherArtwork.posY2d + otherArtwork.height2d - artwork.height2d
          }
          if (alignment.horizontal === 'center-horizontal') {
            snapY = otherArtwork.posY2d + otherArtwork.height2d / 2 - artwork.height2d / 2
          }

          alignedPairs.push({
            from: draggedArtworkId,
            to: otherArtwork.id,
            direction: alignment.horizontal,
          })
        }

        if (alignment.vertical) {
          if (alignment.vertical === 'left') {
            snapX = otherArtwork.posX2d
          }
          if (alignment.vertical === 'right') {
            snapX = otherArtwork.posX2d + otherArtwork.width2d - artwork.width2d
          }
          if (alignment.vertical === 'center-vertical') {
            snapX = otherArtwork.posX2d + otherArtwork.width2d / 2 - artwork.width2d / 2
          }

          alignedPairs.push({
            from: draggedArtworkId,
            to: otherArtwork.id,
            direction: alignment.vertical,
          })
        }
      })

      dispatch(setAlignedPairs(alignedPairs))

      const artworkPosition = {
        posX2d: snapX,
        posY2d: snapY,
      }

      const new3DCoordinate = convert2DTo3D(
        snapX,
        snapY,
        artwork.width2d,
        artwork.height2d,
        boundingData,
      )

      dispatch(
        updateArtworkPosition({
          artworkId: draggedArtworkId,
          artworkPosition: { ...artworkPosition, ...new3DCoordinate },
        }),
      )
    },
    [
      isDragging,
      draggedArtworkId,
      wallRef,
      boundingData,
      scaleFactor,
      offset,
      currentWallId,
      allExhibitionArtworkIds,
      exhibitionArtworksById,
      dispatch,
    ],
  )

  const handleArtworkDragEnd = useCallback(() => {
    dispatch(stopDragging())
    setDraggedArtworkId(null)
  }, [dispatch])

  useEffect(() => {
    if (isDragging) {
      const moveHandler = (event: MouseEvent) => handleArtworkDragMove(event)
      const upHandler = () => handleArtworkDragEnd()

      document.addEventListener('mousemove', moveHandler)
      document.addEventListener('mouseup', upHandler)

      return () => {
        document.removeEventListener('mousemove', moveHandler)
        document.removeEventListener('mouseup', upHandler)
      }
    }
  }, [isDragging, handleArtworkDragMove, handleArtworkDragEnd])

  return useMemo(
    () => ({
      draggedArtworkId,
      handleArtworkDragStart,
      handleArtworkDragMove,
      handleArtworkDragEnd,
    }),
    [draggedArtworkId, handleArtworkDragStart, handleArtworkDragMove, handleArtworkDragEnd],
  )
}
