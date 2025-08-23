import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'
import { chooseCurrentArtworkId } from '@/redux/slices/wallViewSlice'

export const useSelectBox = (wallRef, boundingData, scaleFactor, preventClick) => {
  const exhibitionArtworksById = useSelector((state) => state.exhibition.exhibitionArtworksById)

  const allExhibitionArtworkIds = useSelector((state) => state.exhibition.allExhibitionArtworkIds)

  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const dispatch = useDispatch()

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

  const handleSelectMouseDown = useCallback(
    (e) => {
      const rect = wallRef.current.getBoundingClientRect()
      const startX = (e.clientX - rect.left) / scaleFactor
      const startY = (e.clientY - rect.top) / scaleFactor

      startPosition.current = { x: startX, y: startY }
      setSelectionBox({ startX, startY, endX: startX, endY: startY })
    },
    [wallRef, scaleFactor],
  )

  const handleSelectMouseMove = useCallback(
    (e) => {
      if (!selectionBox) return

      const rect = wallRef.current.getBoundingClientRect()
      const endX = (e.clientX - rect.left) / scaleFactor
      const endY = (e.clientY - rect.top) / scaleFactor

      const deltaX = Math.abs(endX - startPosition.current.x)
      const deltaY = Math.abs(endY - startPosition.current.y)

      if (deltaX > dragThreshold || deltaY > dragThreshold) {
        preventClick.current = true
        setDraggingSelectBox(true)
        setSelectionBox((prev) => ({ ...prev, endX, endY }))
      }
    },
    [selectionBox, wallRef, scaleFactor, dragThreshold, preventClick],
  )

  const handleSelectMouseUp = useCallback(() => {
    if (!selectionBox || !draggingSelectBox) {
      setSelectionBox(null)
      return
    }

    const { startX, startY, endX, endY } = selectionBox

    const minX = Math.min(startX, endX)
    const minY = Math.min(startY, endY)
    const maxX = Math.max(startX, endX)
    const maxY = Math.max(startY, endY)

    const filteredArtworks = allExhibitionArtworkIds
      .map((id) => exhibitionArtworksById[id])
      .filter((artwork) => artwork.wallId === currentWallId)

    const selectedArtworks = filteredArtworks.filter((artwork) => {
      const artX = artwork.posX2d
      const artY = artwork.posY2d
      const artWidth = artwork.width2d
      const artHeight = artwork.height2d

      const intersects =
        minX < artX + artWidth && maxX > artX && minY < artY + artHeight && maxY > artY

      return intersects
    })

    if (selectedArtworks.length === 1) {
      dispatch(chooseCurrentArtworkId(selectedArtworks[0].id))
    }

    selectedArtworks.forEach((artwork) => {
      handleAddArtworkToGroup(artwork.id)
    })

    setSelectionBox(null)
    setDraggingSelectBox(false)
  }, [
    selectionBox,
    draggingSelectBox,
    allExhibitionArtworkIds,
    exhibitionArtworksById,
    handleAddArtworkToGroup,
  ])

  useEffect(() => {
    if (draggingSelectBox) {
      const moveHandler = (event) => handleSelectMouseMove(event)
      const upHandler = () => handleSelectMouseUp()

      document.addEventListener('mousemove', moveHandler)
      document.addEventListener('mouseup', upHandler)

      return () => {
        document.removeEventListener('mousemove', moveHandler)
        document.removeEventListener('mouseup', upHandler)
      }
    }
  }, [draggingSelectBox, handleSelectMouseMove, handleSelectMouseUp])

  return useMemo(
    () => ({
      handleSelectMouseDown,
      handleSelectMouseMove,
      handleSelectMouseUp,
      selectionBox,
    }),
    [handleSelectMouseDown, handleSelectMouseMove, handleSelectMouseUp, selectionBox],
  )
}
