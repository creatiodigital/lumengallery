import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtwork, edit3DCoordinates } from '@/lib/features/artistSlice'
import {
  addArtworkToGroup,
  removeGroup,
  createArtworkGroup,
  editArtworkGroup,
  startDraggingGroup,
  stopDraggingGroup,
  chooseCurrentArtworkId,
} from '@/lib/features/wallViewSlice'

export const useGroupArtwork = (wallRef, boundingData, scaleFactor, preventClick) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const artworks = useSelector((state) => state.artist.artworks)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleAddArtworkToGroup = (artworkId) => {
    if (!artworkGroupIds.includes(artworkId)) {
      dispatch(addArtworkToGroup(artworkId))
    }
  }

  const handleCreateArtworkGroup = () => {
    if (artworkGroupIds.length === 0) return

    const artworkGroupItems = artworks.filter((artwork) => artworkGroupIds.includes(artwork.id))
    const xValues = artworkGroupItems.map((artwork) => artwork.canvas.x)
    const xEdgeValues = artworkGroupItems.map((artwork) => artwork.canvas.x + artwork.canvas.width)
    const yValues = artworkGroupItems.map((artwork) => artwork.canvas.y)
    const yEdgeValues = artworkGroupItems.map((artwork) => artwork.canvas.y + artwork.canvas.height)

    const groupX = Math.min(...xValues)
    const maxGroupX = Math.max(...xEdgeValues)
    const groupY = Math.min(...yValues)
    const maxGroupY = Math.max(...yEdgeValues)
    const groupWidth = maxGroupX - groupX
    const groupHeight = maxGroupY - groupY

    const groupProps = {
      groupX,
      groupY,
      groupWidth,
      groupHeight,
    }

    dispatch(createArtworkGroup(groupProps))
  }

  const handleRemoveArtworkGroup = () => {
    dispatch(removeGroup())
  }

  const handleGroupDragStart = (event) => {
    if (!wallRef.current) return

    dispatch(chooseCurrentArtworkId(null))

    const rect = wallRef.current.getBoundingClientRect()
    const offsetX = (event.clientX - rect.left) / scaleFactor - artworkGroup.groupX
    const offsetY = (event.clientY - rect.top) / scaleFactor - artworkGroup.groupY

    setOffset({ x: offsetX, y: offsetY })

    dispatch(startDraggingGroup())

    preventClick.current = true
  }

  const handleGroupDragMove = (event) => {
    if (!wallRef.current || !boundingData) return

    const rect = wallRef.current.getBoundingClientRect()
    const scaledMouseX = (event.clientX - rect.left) / scaleFactor
    const scaledMouseY = (event.clientY - rect.top) / scaleFactor

    let x = scaledMouseX - offset.x
    let y = scaledMouseY - offset.y

    const deltaX = x - artworkGroup.groupX // Change in X position
    const deltaY = y - artworkGroup.groupY

    const artworkGroupProps = {
      groupX: x,
      groupY: y,
    }

    dispatch(editArtworkGroup(artworkGroupProps))

    artworkGroupIds.forEach((artworkId) => {
      const artwork = artworks.find((art) => art.id === artworkId)

      if (artwork) {
        const newArtworkCanvas = {
          x: artwork.canvas.x + deltaX,
          y: artwork.canvas.y + deltaY,
          width: artwork.canvas.width,
          height: artwork.canvas.height,
        }

        dispatch(
          editArtwork({
            currentArtworkId: artworkId,
            newArtworkSizes: newArtworkCanvas,
          }),
        )

        // Optional: Update 3D coordinates if needed
        const new3DCoordinate = convert2DTo3D(
          {
            x: newArtworkCanvas.x,
            y: newArtworkCanvas.y,
            size: { w: newArtworkCanvas.width, h: newArtworkCanvas.height },
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
    })
  }

  const handleGroupDragEnd = () => {
    dispatch(stopDraggingGroup())

    setTimeout(() => {
      preventClick.current = false
    }, 100)
  }

  useEffect(() => {
    if (artworkGroupIds.length > 0) {
      handleCreateArtworkGroup()
    }
  }, [artworkGroupIds])

  return {
    handleCreateArtworkGroup,
    handleAddArtworkToGroup,
    handleRemoveArtworkGroup,
    handleGroupDragStart,
    handleGroupDragMove,
    handleGroupDragEnd,
  }
}
