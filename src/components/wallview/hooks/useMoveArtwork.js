import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { edit3DCoordinates, editArtwork } from '@/lib/features/artistSlice'
import { setAlignedPairs, startDragging, stopDragging } from '@/lib/features/wallViewSlice'

import { convert2DTo3D } from '../utils'

const areAligned = (artworkA, artworkB, tolerance = 2) => {
  const isHorizontallyAligned = Math.abs(artworkA.y - artworkB.y) <= tolerance
  const isVerticallyAligned = Math.abs(artworkA.x - artworkB.x) <= tolerance

  return {
    horizontally: isHorizontallyAligned,
    vertically: isVerticallyAligned,
  }
}

export const useMoveArtwork = (wallRef, boundingData, scaleFactor) => {
  const [draggedArtworkId, setDraggedArtworkId] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const artworks = useSelector((state) => state.artist.artworks)
  const isEditingArtwork = useSelector((state) => state.dashboard.isEditingArtwork)
  const isDragging = useSelector((state) => state.wallView.isDragging)
  const dispatch = useDispatch()

  const handleDragStart = (event, artworkId) => {
    if (isEditingArtwork || !wallRef.current) return

    const rect = wallRef.current.getBoundingClientRect()
    const artwork = artworks.find((art) => art.id === artworkId)
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

    let snapX = x
    let snapY = y

    const alignedPairs = []

    artworks.forEach((otherArtwork) => {
      if (otherArtwork.id !== draggedArtworkId) {
        const alignment = areAligned({ x: snapX, y: snapY }, otherArtwork.canvas)

        if (alignment.horizontally) {
          snapY = otherArtwork.canvas.y
          alignedPairs.push({
            from: draggedArtworkId,
            to: otherArtwork.id,
            direction: 'horizontal',
          })
        }

        if (alignment.vertically) {
          console.log(
            `Artwork ${draggedArtworkId} is vertically aligned with Artwork ${otherArtwork.id}`,
          )
          snapX = otherArtwork.canvas.x
          alignedPairs.push({
            from: draggedArtworkId,
            to: otherArtwork.id,
            direction: 'vertical',
          })
        }
      }
    })

    dispatch(setAlignedPairs(alignedPairs))

    // Apply snapping adjustments to updated canvas
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
