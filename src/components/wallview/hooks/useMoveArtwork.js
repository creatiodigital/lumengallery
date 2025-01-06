import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { edit3DCoordinates, editArtwork } from '@/lib/features/artistSlice'
import { setAlignedPairs, startDragging, stopDragging } from '@/lib/features/wallViewSlice'

import { convert2DTo3D } from '../utils'

const tolerance = 3

const areAligned = (artworkA, artworkB) => {
  const directions = {
    horizontal: null,
    vertical: null,
  }

  if (Math.abs(artworkA.y - artworkB.y) <= tolerance) {
    directions.horizontal = 'top'
  }

  if (Math.abs(artworkA.y + artworkA.height - (artworkB.y + artworkB.height)) <= tolerance) {
    directions.horizontal = 'bottom'
  }

  if (
    Math.abs(artworkA.y + artworkA.height / 2 - (artworkB.y + artworkB.height / 2)) <= tolerance
  ) {
    directions.horizontal = 'center-horizontal'
  }

  if (Math.abs(artworkA.x - artworkB.x) <= tolerance) {
    directions.vertical = 'left'
  }

  if (Math.abs(artworkA.x + artworkA.width - (artworkB.x + artworkB.width)) <= tolerance) {
    directions.vertical = 'right'
  }
  if (Math.abs(artworkA.x + artworkA.width / 2 - (artworkB.x + artworkB.width / 2)) <= tolerance) {
    directions.vertical = 'center-vertical'
  }

  return directions
}

export const useMoveArtwork = (wallRef, boundingData, scaleFactor) => {
  const [draggedArtworkId, setDraggedArtworkId] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const artworks = useSelector((state) => state.artist.artworks)
  const isEditingArtwork = useSelector((state) => state.dashboard.isEditingArtwork)
  const isDragging = useSelector((state) => state.wallView.isDragging)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const dispatch = useDispatch()

  const handleDragStart = (event, artworkId) => {
    if (isEditingArtwork || !wallRef.current) return

    const rect = wallRef.current.getBoundingClientRect()
    const artwork = artworks?.find((art) => art.id === artworkId)
    if (!artwork) return

    const offsetX = (event.clientX - rect.left) / scaleFactor - artwork.canvas.x
    const offsetY = (event.clientY - rect.top) / scaleFactor - artwork.canvas.y
    setOffset({ x: offsetX, y: offsetY })

    dispatch(startDragging())
    setDraggedArtworkId(artworkId)
  }

  const handleDragMove = (event) => {
    if (!isDragging || !draggedArtworkId || !wallRef.current || !boundingData) return

    const rect = wallRef.current.getBoundingClientRect()
    const scaledMouseX = (event.clientX - rect.left) / scaleFactor
    const scaledMouseY = (event.clientY - rect.top) / scaleFactor

    let x = scaledMouseX - offset.x
    let y = scaledMouseY - offset.y

    const artwork = artworks.find((art) => art.id === draggedArtworkId)
    if (!artwork) return

    // Filter artworks to only include those on the current wall
    const sameWallArtworks = artworks.filter(
      (otherArtwork) =>
        otherArtwork.wallId === currentWallId && otherArtwork.id !== draggedArtworkId,
    )

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
          snapY = otherArtwork.canvas.y + otherArtwork.canvas.height / 2 - artwork.canvas.height / 2 // Align horizontal centers
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
      editArtwork({
        currentArtworkId: draggedArtworkId,
        newArtworkSizes: updatedCanvas,
      }),
    )

    const new3DCoordinate = convert2DTo3D(
      { x: snapX, y: snapY, size: { w: updatedCanvas.width, h: updatedCanvas.height } },
      boundingData,
    )

    dispatch(
      edit3DCoordinates({
        currentArtworkId: draggedArtworkId,
        serialized3DCoordinate: new3DCoordinate,
      }),
    )
  }

  const handleDragEnd = () => {
    dispatch(stopDragging())
    setDraggedArtworkId(null)
  }

  return {
    draggedArtworkId,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  }
}
