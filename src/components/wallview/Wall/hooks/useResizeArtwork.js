import { useDispatch, useSelector } from 'react-redux'

import { edit3DCoordinates, editArtwork } from '@/lib/features/artistSlice'

import { convert2DTo3D } from '../utils'

export const useResizeArtwork = (boundingData, scaleFactor) => {
  const artworks = useSelector((state) => state.artist.artworks)
  const dispatch = useDispatch()

  const handleResize = (event, artworkId, direction) => {
    event.stopPropagation()

    const artwork = artworks.find((art) => art.id === artworkId)
    if (!artwork) return

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
      }

      if (direction.includes('right')) {
        newWidth = Math.max(20, initialWidth + deltaX)
      }

      if (direction.includes('top')) {
        newHeight = Math.max(20, initialHeight - deltaY)
        newY = initialY + deltaY
      }

      if (direction.includes('bottom')) {
        newHeight = Math.max(20, initialHeight + deltaY)
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
