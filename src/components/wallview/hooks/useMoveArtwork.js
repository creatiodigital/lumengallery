import { useState, useMemo, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D, convert2DTo3DE } from '@/components/wallview/utils'
import { editArtworkSpace, editArtworkCanvas } from '@/lib/features/artworksSlice'
import {
  setAlignedPairs,
  startDragging,
  stopDragging,
  chooseCurrentArtworkId,
} from '@/lib/features/wallViewSlice'

import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'

import { areAligned } from './helpers'

export const useMoveArtwork = (wallRef, boundingData, scaleFactor) => {
  const [draggedArtworkId, setDraggedArtworkId] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const artworksById = useSelector((state) => state.artworks.byId)
  const allIds = useSelector((state) => state.artworks.allIds)
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
      const artwork = artworksById[artworkId]
      if (!artwork) return

      const offsetX = (event.clientX - rect.left) / scaleFactor - artwork.canvas.x
      const offsetY = (event.clientY - rect.top) / scaleFactor - artwork.canvas.y
      setOffset({ x: offsetX, y: offsetY })

      dispatch(startDragging())
      setDraggedArtworkId(artworkId)
      dispatch(chooseCurrentArtworkId(artworkId))
    },
    [isEditingArtwork, wallRef, isArtworkVisible, artworksById, scaleFactor, dispatch],
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

      const artwork = artworksById[draggedArtworkId]
      if (!artwork) return

      const sameWallArtworks = allIds
        .map((id) => artworksById[id])
        .filter((artwork) => artwork.wallId === currentWallId && artwork.id !== draggedArtworkId)

      let snapX = x
      let snapY = y

      const alignedPairs = []

      sameWallArtworks.forEach((otherArtwork) => {
        const alignment = areAligned(
          { x: snapX, y: snapY, width: artwork.canvas.width, height: artwork.canvas.height },
          {
            x: otherArtwork.canvas.x,
            y: otherArtwork.canvas.y,
            width: otherArtwork.canvas.width,
            height: otherArtwork.canvas.height,
          },
        )

        if (alignment.horizontal) {
          if (alignment.horizontal === 'top') {
            snapY = otherArtwork.canvas.y // Align top
          }
          if (alignment.horizontal === 'bottom') {
            snapY = otherArtwork.canvas.y + otherArtwork.canvas.height - artwork.canvas.height // Align bottom
          }
          if (alignment.horizontal === 'center-horizontal') {
            snapY =
              otherArtwork.canvas.y + otherArtwork.canvas.height / 2 - artwork.canvas.height / 2 // Align horizontal centers
          }

          alignedPairs.push({
            from: draggedArtworkId,
            to: otherArtwork.id,
            direction: alignment.horizontal,
          })
        }

        if (alignment.vertical) {
          if (alignment.vertical === 'left') {
            snapX = otherArtwork.canvas.x
          }
          if (alignment.vertical === 'right') {
            snapX = otherArtwork.canvas.x + otherArtwork.canvas.width - artwork.canvas.width
          }
          if (alignment.vertical === 'center-vertical') {
            snapX = otherArtwork.canvas.x + otherArtwork.canvas.width / 2 - artwork.canvas.width / 2
          }

          alignedPairs.push({
            from: draggedArtworkId,
            to: otherArtwork.id,
            direction: alignment.vertical,
          })
        }
      })

      dispatch(setAlignedPairs(alignedPairs))

      const updatedCanvas = { ...artwork.canvas, x: snapX, y: snapY }

      dispatch(
        editArtworkCanvas({ currentArtworkId: draggedArtworkId, canvasUpdates: updatedCanvas }),
      )

      const new3DCoordinate = convert2DTo3D(
        { x: snapX, y: snapY, size: { w: updatedCanvas.width, h: updatedCanvas.height } },
        boundingData,
      )

      dispatch(
        editArtworkSpace({
          currentArtworkId: draggedArtworkId,
          spaceUpdates: new3DCoordinate,
        }),
      )

      //NEW WAY
      const artworkPositionE = {
        posX2d: snapX,
        posY2d: snapY,
      }

      const new3DCoordinateE = convert2DTo3DE(
        {
          x: snapX,
          y: snapY,
          size: { w: updatedCanvas.width, h: updatedCanvas.height },
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
