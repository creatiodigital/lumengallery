import { useCallback, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { getArtworkBorderPx, WALL_SCALE } from '@/components/wallview/constants'
import { convert2DTo3D, getVisualBounds } from '@/components/wallview/utils'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import {
  setAlignedPairs,
  clearAlignedPairs,
  startResizing,
  stopResizing,
} from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TDirection, TAlignmentPair } from '@/types/wallView'

const BASE_SNAP_TOLERANCE = 2

export const useResizeArtwork = (
  boundingData: TDimensions | null,
  scaleFactor: number,
  wallRef: RefObject<HTMLDivElement | null>,
) => {
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const allExhibitionArtworkIds = useSelector(
    (state: RootState) => state.exhibition.allExhibitionArtworkIds,
  )
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)

  const dispatch = useDispatch()
  const isGridVisible = useSelector((state: RootState) => state.wallView.isGridVisible)
  const sizeLockedById = useSelector((state: RootState) => state.wallView.sizeLockedById)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const isSnapEnabled = useSelector((state: RootState) => state.wallView.isSnapEnabled)
  const guides = useSelector((state: RootState) => state.wallView.guides)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)
  const gridSize = 20

  // Track if we're currently resizing
  const isResizingRef = useRef(false)

  const handleResize = useCallback(
    (event: React.MouseEvent, artworkId: string, direction: TDirection) => {
      event.stopPropagation()

      const artwork = exhibitionArtworksById[artworkId]

      if (!artwork || !wallRef.current) return

      // Block resize on locked artworks
      if (artwork.locked) return

      const rect = wallRef.current.getBoundingClientRect()

      const gridOffsetX = (rect.width % gridSize) / 2
      const gridOffsetY = (rect.height % gridSize) / 2

      const startX = event.clientX
      const startY = event.clientY
      const initialWidth = artwork.width2d
      const initialHeight = artwork.height2d
      const initialX = artwork.posX2d
      const initialY = artwork.posY2d

      // Get other artworks on the same wall for snapping (use visual bounds)
      const sameWallArtworks = allExhibitionArtworkIds
        .filter((id) => id !== artworkId && exhibitionArtworksById[id].wallId === currentWallId)
        .map((id) => ({
          pos: exhibitionArtworksById[id],
          visual: getVisualBounds(
            exhibitionArtworksById[id],
            artworksById[exhibitionArtworksById[id].artworkId],
          ),
        }))

      // Start resizing state
      dispatch(pushToHistory()) // Save current state before resize
      dispatch(startResizing())
      isResizingRef.current = true

      // Calculate aspect ratio for proportional resize
      const aspectRatio = initialWidth / initialHeight

      // Check if this is a corner resize (has both horizontal and vertical components)
      const isCornerResize =
        (direction.includes('left') || direction.includes('right')) &&
        (direction.includes('top') || direction.includes('bottom'))

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = (moveEvent.clientX - startX) / scaleFactor
        const deltaY = (moveEvent.clientY - startY) / scaleFactor

        // Snap tolerance scales inversely with zoom — tighter at high zoom
        const SNAP_TOLERANCE = BASE_SNAP_TOLERANCE / scaleFactor

        let newWidth = initialWidth
        let newHeight = initialHeight
        let newX = initialX
        let newY = initialY

        const alignedPairs: TAlignmentPair[] = []

        // Proportional resize with Shift key OR sizeLocked checkbox
        const sizeLocked = sizeLockedById[artworkId] ?? false
        const proportional = moveEvent.shiftKey || sizeLocked
        if (proportional && isCornerResize) {
          // Calculate scale factor based on diagonal movement for smooth proportional resize
          // Determine the direction signs based on which corner handle is being dragged
          const xSign = direction.includes('left') ? -1 : 1
          const ySign = direction.includes('top') ? -1 : 1

          // Project the mouse movement onto the diagonal direction
          // This gives a smooth scale factor without sudden jumps
          const diagonalDelta = (deltaX * xSign + deltaY * ySign * aspectRatio) / (1 + aspectRatio)

          // Apply the scale
          newWidth = Math.max(5, initialWidth + diagonalDelta * xSign)
          newHeight = Math.max(5, newWidth / aspectRatio)

          // Adjust position for left/top handles
          if (direction.includes('left')) {
            newX = initialX + initialWidth - newWidth
          }
          if (direction.includes('top')) {
            newY = initialY + initialHeight - newHeight
          }

          // Add edge snapping for proportional resize to show alignment lines
          // Only check edges that are actually moving based on the resize direction
          if (!isGridVisible) {
            for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
              const newRight = newX + newWidth
              const newBottom = newY + newHeight
              const otherRight = otherVisual.x + otherVisual.width
              const otherBottom = otherVisual.y + otherVisual.height

              // Only check left edge if dragging from left side
              if (direction.includes('left') && Math.abs(newX - otherVisual.x) <= SNAP_TOLERANCE) {
                alignedPairs.push({ from: artworkId, to: otherPos.artworkId, direction: 'left' })
              }
              // Only check right edge if dragging from right side
              if (
                direction.includes('right') &&
                Math.abs(newRight - otherRight) <= SNAP_TOLERANCE
              ) {
                alignedPairs.push({ from: artworkId, to: otherPos.artworkId, direction: 'right' })
              }
              // Only check top edge if dragging from top side
              if (direction.includes('top') && Math.abs(newY - otherVisual.y) <= SNAP_TOLERANCE) {
                alignedPairs.push({ from: artworkId, to: otherPos.artworkId, direction: 'top' })
              }
              // Only check bottom edge if dragging from bottom side
              if (
                direction.includes('bottom') &&
                Math.abs(newBottom - otherBottom) <= SNAP_TOLERANCE
              ) {
                alignedPairs.push({ from: artworkId, to: otherPos.artworkId, direction: 'bottom' })
              }
            }
          }
        } else if (proportional) {
          // Side-handle proportional resize: scale the perpendicular axis
          // around the original center so the artwork stays anchored to the
          // edge opposite the handle being dragged.
          if (direction.includes('right')) {
            newWidth = Math.max(5, initialWidth + deltaX)
            newHeight = Math.max(5, newWidth / aspectRatio)
            newY = initialY + (initialHeight - newHeight) / 2
          } else if (direction.includes('left')) {
            newWidth = Math.max(5, initialWidth - deltaX)
            newHeight = Math.max(5, newWidth / aspectRatio)
            newX = initialX + (initialWidth - newWidth)
            newY = initialY + (initialHeight - newHeight) / 2
          } else if (direction.includes('bottom')) {
            newHeight = Math.max(5, initialHeight + deltaY)
            newWidth = Math.max(5, newHeight * aspectRatio)
            newX = initialX + (initialWidth - newWidth) / 2
          } else if (direction.includes('top')) {
            newHeight = Math.max(5, initialHeight - deltaY)
            newWidth = Math.max(5, newHeight * aspectRatio)
            newY = initialY + (initialHeight - newHeight)
            newX = initialX + (initialWidth - newWidth) / 2
          }
        } else {
          // Original non-proportional resize logic
          // Get the dragged artwork's own border offset to compare visual edges
          const artData = artworksById[artworkId]
          const borderPx = artData ? getArtworkBorderPx(artData) : 0

          // Handle LEFT edge
          if (direction.includes('left')) {
            newWidth = Math.max(5, initialWidth - deltaX)
            newX = initialX + deltaX

            if (isGridVisible) {
              newX = Math.round((newX - gridOffsetX) / gridSize) * gridSize + gridOffsetX
              newWidth = Math.max(5, initialWidth - (newX - initialX))
            } else if (isSnapEnabled) {
              // Snap left edge to other artworks' left edges (compare visual edges)
              const myVisualLeft = newX - borderPx
              for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
                if (Math.abs(myVisualLeft - otherVisual.x) <= SNAP_TOLERANCE) {
                  newX = otherVisual.x + borderPx
                  newWidth = Math.max(5, initialX + initialWidth - newX)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherPos.artworkId,
                    direction: 'left',
                  })
                  break
                }
              }
              // Snap left edge to vertical guides
              const wallHeight2d = (wallHeight ?? 3) * WALL_SCALE
              for (const guide of guides) {
                if (guide.orientation === 'vertical') {
                  const guidePx = guide.position * WALL_SCALE
                  if (Math.abs(newX - borderPx - guidePx) <= SNAP_TOLERANCE) {
                    newX = guidePx + borderPx
                    newWidth = Math.max(5, initialX + initialWidth - newX)
                    break
                  }
                } else {
                  const guidePx = wallHeight2d - guide.position * WALL_SCALE
                  if (Math.abs(newY - borderPx - guidePx) <= SNAP_TOLERANCE) {
                    // horizontal guide near top edge during left resize — skip, handled by top
                  }
                }
              }
            }
          }

          if (direction.includes('right')) {
            newWidth = Math.max(5, initialWidth + deltaX)
            const myVisualRight = newX + newWidth + borderPx

            if (isGridVisible) {
              newWidth =
                Math.round((newX + newWidth - gridOffsetX) / gridSize) * gridSize -
                newX +
                gridOffsetX
            } else if (isSnapEnabled) {
              // Snap right edge to other artworks' right edges (compare visual edges)
              for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
                const otherRight = otherVisual.x + otherVisual.width
                if (Math.abs(myVisualRight - otherRight) <= SNAP_TOLERANCE) {
                  newWidth = Math.max(5, otherRight - borderPx - newX)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherPos.artworkId,
                    direction: 'right',
                  })
                  break
                }
              }
              // Snap right edge to vertical guides
              for (const guide of guides) {
                if (guide.orientation === 'vertical') {
                  const guidePx = guide.position * WALL_SCALE
                  if (Math.abs(newX + newWidth + borderPx - guidePx) <= SNAP_TOLERANCE) {
                    newWidth = Math.max(5, guidePx - borderPx - newX)
                    break
                  }
                }
              }
            }
          }

          if (direction.includes('top')) {
            newHeight = Math.max(5, initialHeight - deltaY)
            newY = initialY + deltaY

            if (isGridVisible) {
              newY = Math.round((newY - gridOffsetY) / gridSize) * gridSize + gridOffsetY
              newHeight = Math.max(5, initialHeight - (newY - initialY))
            } else if (isSnapEnabled) {
              // Snap top edge to other artworks' top edges (compare visual edges)
              const myVisualTop = newY - borderPx
              for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
                if (Math.abs(myVisualTop - otherVisual.y) <= SNAP_TOLERANCE) {
                  newY = otherVisual.y + borderPx
                  newHeight = Math.max(5, initialY + initialHeight - newY)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherPos.artworkId,
                    direction: 'top',
                  })
                  break
                }
              }
              // Snap top edge to horizontal guides
              const wallHeight2d = (wallHeight ?? 3) * WALL_SCALE
              for (const guide of guides) {
                if (guide.orientation === 'horizontal') {
                  const guidePx = wallHeight2d - guide.position * WALL_SCALE
                  if (Math.abs(newY - borderPx - guidePx) <= SNAP_TOLERANCE) {
                    newY = guidePx + borderPx
                    newHeight = Math.max(5, initialY + initialHeight - newY)
                    break
                  }
                }
              }
            }
          }

          if (direction.includes('bottom')) {
            newHeight = Math.max(5, initialHeight + deltaY)
            const myVisualBottom = newY + newHeight + borderPx

            if (isGridVisible) {
              newHeight =
                Math.round((newY + newHeight - gridOffsetY) / gridSize) * gridSize -
                newY +
                gridOffsetY
            } else if (isSnapEnabled) {
              // Snap bottom edge to other artworks' bottom edges (compare visual edges)
              for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
                const otherBottom = otherVisual.y + otherVisual.height
                if (Math.abs(myVisualBottom - otherBottom) <= SNAP_TOLERANCE) {
                  newHeight = Math.max(5, otherBottom - borderPx - newY)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherPos.artworkId,
                    direction: 'bottom',
                  })
                  break
                }
              }
              // Snap bottom edge to horizontal guides
              const wallHeight2d = (wallHeight ?? 3) * WALL_SCALE
              for (const guide of guides) {
                if (guide.orientation === 'horizontal') {
                  const guidePx = wallHeight2d - guide.position * WALL_SCALE
                  if (Math.abs(newY + newHeight + borderPx - guidePx) <= SNAP_TOLERANCE) {
                    newHeight = Math.max(5, guidePx - borderPx - newY)
                    break
                  }
                }
              }
            }
          }
        }

        // Update aligned pairs for visual feedback
        dispatch(setAlignedPairs(alignedPairs))

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

        // Clear resize state and alignment pairs
        dispatch(stopResizing())
        dispatch(clearAlignedPairs())
        isResizingRef.current = false
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [
      exhibitionArtworksById,
      allExhibitionArtworkIds,
      currentWallId,
      wallRef,
      gridSize,
      scaleFactor,
      isGridVisible,
      sizeLockedById,
      artworksById,
      isSnapEnabled,
      guides,
      wallHeight,
      boundingData,
      dispatch,
    ],
  )

  return useMemo(
    () => ({
      handleResize,
    }),
    [handleResize],
  )
}
