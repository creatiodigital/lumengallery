import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { edit3DCoordinates, editArtwork } from '@/lib/features/artistSlice'
import { setAlignedPairs } from '@/lib/features/wallViewSlice'

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
  const [dragging, setDragging] = useState(false)
  const [draggedArtworkId, setDraggedArtworkId] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const artworks = useSelector((state) => state.artist.artworks)
  const isEditingArtwork = useSelector((state) => state.dashboard.isEditingArtwork)
  const dispatch = useDispatch()

  const handleDragStart = (event, artworkId) => {
    if (isEditingArtwork || !wallRef.current) return

    const rect = wallRef.current.getBoundingClientRect()
    const artwork = artworks.find((art) => art.id === artworkId)
    if (!artwork) return

    const offsetX = (event.clientX - rect.left) / scaleFactor - artwork.canvas.x
    const offsetY = (event.clientY - rect.top) / scaleFactor - artwork.canvas.y
    setOffset({ x: offsetX, y: offsetY })

    setDragging(true)
    setDraggedArtworkId(artworkId)
  }

  const handleDragMove = (event) => {
    if (!dragging || !draggedArtworkId || !wallRef.current || !boundingData) return

    const rect = wallRef.current.getBoundingClientRect()
    const scaledMouseX = (event.clientX - rect.left) / scaleFactor
    const scaledMouseY = (event.clientY - rect.top) / scaleFactor

    let x = scaledMouseX - offset.x
    let y = scaledMouseY - offset.y

    const artwork = artworks.find((art) => art.id === draggedArtworkId)
    if (!artwork) return

    // Initialize snapping adjustments
    let snapX = x
    let snapY = y

    const alignedPairs = []

    // Check alignment and apply snapping
    artworks.forEach((otherArtwork) => {
      if (otherArtwork.id !== draggedArtworkId) {
        const alignment = areAligned(
          { x: snapX, y: snapY }, // Current position of dragged artwork
          otherArtwork.canvas,
        )

        if (alignment.horizontally) {
          snapY = otherArtwork.canvas.y // Snap to the y position of the aligned artwork
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
          snapX = otherArtwork.canvas.x // Snap to the x position of the aligned artwork
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
    setDragging(false)
    setDraggedArtworkId(null)
  }

  return {
    dragging,
    draggedArtworkId,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  }
}
