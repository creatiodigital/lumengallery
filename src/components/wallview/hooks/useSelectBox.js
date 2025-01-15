import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'

import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'

export const useSelectBox = (wallRef, boundingData, scaleFactor, preventClick) => {
  const artworks = useSelector((state) => state.artist.artworks)

  const { handleAddArtworkToGroup } = useGroupArtwork(
    wallRef,
    boundingData,
    scaleFactor,
    preventClick,
  )

  const [selectionBox, setSelectionBox] = useState(null)
  const [draggingSelectBox, setDraggingSelectBox] = useState(false)
  const startPosition = useRef({ x: 0, y: 0 })
  const dragThreshold = 5

  useEffect(() => {
    if (!draggingSelectBox) {
      const timeout = setTimeout(() => {
        preventClick.current = false
      }, 100)

      return () => clearTimeout(timeout)
    }
  }, [draggingSelectBox])

  const handleSelectMouseDown = (e) => {
    const rect = wallRef.current.getBoundingClientRect()
    const startX = (e.clientX - rect.left) / scaleFactor
    const startY = (e.clientY - rect.top) / scaleFactor

    startPosition.current = { x: startX, y: startY } // Record the start position
    setSelectionBox({ startX, startY, endX: startX, endY: startY })
  }

  const handleSelectMouseMove = (e) => {
    if (!selectionBox) return

    const rect = wallRef.current.getBoundingClientRect()
    const endX = (e.clientX - rect.left) / scaleFactor
    const endY = (e.clientY - rect.top) / scaleFactor

    // Check if the mouse has moved beyond the threshold
    const deltaX = Math.abs(endX - startPosition.current.x)
    const deltaY = Math.abs(endY - startPosition.current.y)

    if (deltaX > dragThreshold || deltaY > dragThreshold) {
      preventClick.current = true // Set preventClick to true only if it's a drag
      setDraggingSelectBox(true)
      setSelectionBox((prev) => ({ ...prev, endX, endY }))
    }
  }

  const handleSelectMouseUp = () => {
    if (!selectionBox || !draggingSelectBox) {
      // Reset if it wasn't a drag
      setSelectionBox(null)
      return
    }

    const { startX, startY, endX, endY } = selectionBox

    const minX = Math.min(startX, endX)
    const minY = Math.min(startY, endY)
    const maxX = Math.max(startX, endX)
    const maxY = Math.max(startY, endY)

    const selectedArtworks = artworks.filter((artwork) => {
      const artX = artwork.canvas.x
      const artY = artwork.canvas.y
      const artWidth = artwork.canvas.width
      const artHeight = artwork.canvas.height

      return artX >= minX && artY >= minY && artX + artWidth <= maxX && artY + artHeight <= maxY
    })

    selectedArtworks.forEach((artwork) => {
      handleAddArtworkToGroup(artwork.id)
    })

    setSelectionBox(null)
    setDraggingSelectBox(false) // Reset dragging state
  }

  return {
    handleSelectMouseDown,
    handleSelectMouseMove,
    handleSelectMouseUp,
    selectionBox,
  }
}
