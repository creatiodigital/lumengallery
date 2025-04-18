import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'

export const useResizeArtwork = (boundingData, scaleFactor, wallRef) => {
  const artworksById = useSelector((state) => state.artworks.byId)
  const positionsById = useSelector((state) => state.exhibition.positionsById)

  const dispatch = useDispatch()
  const isGridVisible = useSelector((state) => state.wallView.isGridVisible)
  const gridSize = 20

  const handleResize = useCallback(
    (event, artworkId, direction) => {
      event.stopPropagation()

      const artwork = positionsById[artworkId]
      if (!artwork || !wallRef.current) return

      const rect = wallRef.current.getBoundingClientRect()

      // Calculate grid offset caused by centering
      const gridOffsetX = (rect.width % gridSize) / 2
      const gridOffsetY = (rect.height % gridSize) / 2

      const startX = event.clientX
      const startY = event.clientY
      const initialWidth = artwork.width2d
      const initialHeight = artwork.height2d
      const initialX = artwork.posX2d
      const initialY = artwork.posY2d

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
              Math.round((newY + newHeight - gridOffsetY) / gridSize) * gridSize -
              newY +
              gridOffsetY
          }
        }

        if (boundingData) {
          const artworkPosition = {
            posX2d: newX,
            posY2d: newY,
            width2d: newWidth,
            height2d: newHeight,
          }

          const new3DCoordinate = convert2DTo3D(newX, newY, newWidth, newHeight, boundingData)

          dispatch(
            updateArtworkPosition({
              artworkId,
              artworkPosition: { ...artworkPosition, ...new3DCoordinate },
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
    },
    [artworksById, wallRef, gridSize, scaleFactor, isGridVisible, boundingData, dispatch],
  )

  return useMemo(
    () => ({
      handleResize,
    }),
    [handleResize],
  )
}
