import { useDispatch, useSelector } from 'react-redux'

import { edit3DCoordinates, editArtwork } from '@/lib/features/artistSlice'

import { convert2DTo3D } from '../utils'

export const useResizeArtwork = (boundingData, scaleFactor, wallRef) => {
  const artworks = useSelector((state) => state.artist.artworks)
  const dispatch = useDispatch()
  const isGridVisible = useSelector((state) => state.wallView.isGridVisible)
  const gridSize = 20

  const handleResize = (event, artworkId, direction) => {
    event.stopPropagation()

    const artwork = artworks.find((art) => art.id === artworkId)
    if (!artwork || !wallRef.current) return

    const rect = wallRef.current.getBoundingClientRect()

    // Calculate grid offset caused by centering
    const gridOffsetX = (rect.width % gridSize) / 2
    const gridOffsetY = (rect.height % gridSize) / 2

    const startX = event.clientX
    const startY = event.clientY
    const initialWidth = artwork.canvas.width
    const initialHeight = artwork.canvas.height
    const initialX = artwork.canvas.x
    const initialY = artwork.canvas.y

    const handleMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scaleFactor
      const deltaY = (moveEvent.clientY - startY) / scaleFactor

      let newWidth = initialWidth
      let newHeight = initialHeight
      let newX = initialX
      let newY = initialY

      if (direction.includes('left')) {
        newWidth = Math.max(20, initialWidth - deltaX)
        newX = initialX + deltaX

        // Snap left handle
        if (isGridVisible) {
          newX = Math.round((newX - gridOffsetX) / gridSize) * gridSize + gridOffsetX
          newWidth = Math.max(20, initialWidth - (newX - initialX))
        }
      }

      if (direction.includes('right')) {
        newWidth = Math.max(20, initialWidth + deltaX)

        // Snap right handle
        if (isGridVisible) {
          newWidth =
            Math.round((newX + newWidth - gridOffsetX) / gridSize) * gridSize - newX + gridOffsetX
        }
      }

      if (direction.includes('top')) {
        newHeight = Math.max(20, initialHeight - deltaY)
        newY = initialY + deltaY

        // Snap top handle
        if (isGridVisible) {
          newY = Math.round((newY - gridOffsetY) / gridSize) * gridSize + gridOffsetY
          newHeight = Math.max(20, initialHeight - (newY - initialY))
        }
      }

      if (direction.includes('bottom')) {
        newHeight = Math.max(20, initialHeight + deltaY)

        // Snap bottom handle
        if (isGridVisible) {
          newHeight =
            Math.round((newY + newHeight - gridOffsetY) / gridSize) * gridSize - newY + gridOffsetY
        }
      }

      const updatedCanvas = {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      }

      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          newArtworkSizes: updatedCanvas,
        }),
      )

      if (boundingData) {
        const new3DCoordinate = convert2DTo3D(
          {
            x: newX,
            y: newY,
            size: {
              w: newWidth,
              h: newHeight,
            },
          },
          boundingData,
        )

        dispatch(
          edit3DCoordinates({
            currentArtworkId: artworkId,
            serialized3DCoordinate: new3DCoordinate,
          }),
        )
      }
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return {
    handleResize,
  }
}
