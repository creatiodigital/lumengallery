import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'

export const useSelectBox = (wallRef, scaleFactor, preventClick) => {
  const artworks = useSelector((state) => state.artist.artworks)

  const { handleAddArtworkToGroup } = useGroupArtwork()

  const [selectionBox, setSelectionBox] = useState(null)

  const handleSelectMouseDown = (e) => {
    const rect = wallRef.current.getBoundingClientRect()
    const startX = (e.clientX - rect.left) / scaleFactor
    const startY = (e.clientY - rect.top) / scaleFactor

    setSelectionBox({ startX, startY, endX: startX, endY: startY })
  }

  const handleSelectMouseMove = (e) => {
    if (!selectionBox) return

    const rect = wallRef.current.getBoundingClientRect()
    const endX = (e.clientX - rect.left) / scaleFactor
    const endY = (e.clientY - rect.top) / scaleFactor

    setSelectionBox((prev) => ({ ...prev, endX, endY }))
  }

  const handleSelectMouseUp = () => {
    if (!selectionBox) return

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

    preventClick.current = true

    setTimeout(() => {
      preventClick.current = false
    }, 0)
  }

  return {
    handleSelectMouseDown,
    handleSelectMouseMove,
    handleSelectMouseUp,
    selectionBox,
  }
}
