import { useState, useMemo, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'
import {
  setAlignedPairs,
  startDragging,
  stopDragging,
  chooseCurrentArtworkId,
} from '@/lib/features/wallViewSlice'

import { areAligned } from './helpers'

export const useMoveArtwork = (wallRef, boundingData, scaleFactor) => {
  const [draggedArtworkId, setDraggedArtworkId] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const exhibitionArtworksById = useSelector((state) => state.exhibition.exhibitionArtworksById)
  const allExhibitionArtworkIds = useSelector((state) => state.exhibition.allExhibitionArtworkIds)
  const isEditingArtwork = useSelector((state) => state.dashboard.isEditingArtwork)
  const isDragging = useSelector((state) => state.wallView.isDragging)
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const dispatch = useDispatch()

  const isArtworkVisible = artworkGroupIds.length > 1

  const handleArtworkDragStart = useCallback(
    (event, artworkId) => {
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
    (event) => {
      if (!isDragging || !draggedArtworkId || !boundingData) return

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

      const alignedPairs = []

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
            snapY = otherArtwork.posY2d // Align top
          }
          if (alignment.horizontal === 'bottom') {
            snapY = otherArtwork.posY2d + otherArtwork.height2d - artwork.height2d // Align bottom
          }
          if (alignment.horizontal === 'center-horizontal') {
            snapY = otherArtwork.posY2d + otherArtwork.height2d / 2 - artwork.height2d / 2 // Align horizontal centers
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
      dispatch,
    ],
  )

  const handleArtworkDragEnd = useCallback(() => {
    dispatch(stopDragging())
    setDraggedArtworkId(null)
  }, [dispatch])

  useEffect(() => {
    if (isDragging) {
      const moveHandler = (event) => handleArtworkDragMove(event)
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
