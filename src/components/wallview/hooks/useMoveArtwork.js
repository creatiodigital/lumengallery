import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { edit3DCoordinates, editArtwork } from '@/lib/features/artistSlice'

import { convert2DTo3D } from '../utils'

export const useMoveArtwork = (wallRef, boundingData, scaleFactor) => {
  const [dragging, setDragging] = useState(false)
  const [draggedArtworkId, setDraggedArtworkId] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const artworks = useSelector((state) => state.artist.artworks)
  const isEditingArtwork = useSelector((state) => state.dashboard.isEditingArtwork)
  const isGridVisible = useSelector((state) => state.wallView.isGridVisible)
  const dispatch = useDispatch()

  const gridSize = 20

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

    const { width: artworkWidth, height: artworkHeight } = artwork.canvas

    // Keep within bounds of the wall
    x = Math.max(0, Math.min(x, boundingData.width * 100 - artworkWidth))
    y = Math.max(0, Math.min(y, boundingData.height * 100 - artworkHeight))

    // Snap to grid if grid is visible
    if (isGridVisible && wallRef.current) {
      const rect = wallRef.current.getBoundingClientRect()

      // Calculate the grid offset caused by centering
      const gridOffsetX = (rect.width % gridSize) / 2
      const gridOffsetY = (rect.height % gridSize) / 2

      // Snap the top-left corner of the artwork to the nearest grid line
      x = Math.round((x - gridOffsetX - 10) / gridSize) * gridSize + gridOffsetX + 10
      y = Math.round((y - gridOffsetY - 10) / gridSize) * gridSize + gridOffsetY + 10
    }

    const updatedCanvas = { ...artwork.canvas, x, y }

    dispatch(
      editArtwork({
        currentArtworkId: draggedArtworkId,
        newArtworkSizes: updatedCanvas,
      }),
    )

    const new3DCoordinate = convert2DTo3D(
      { x, y, size: { w: updatedCanvas.width, h: updatedCanvas.height } },
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
