import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import {
  edit3DCoordinates,
  editArtwork,
  editAlignArtwork,
  editArtworkx,
} from '@/lib/features/artworksSlice'

export const useArtworkHandlers = (currentArtworkId, boundingData) => {
  const dispatch = useDispatch()
  const artworks = useSelector((state) => state.artworks.artworks)

  const sanitizeNumberInput = (value) => {
    const normalizedValue = value * 100
    return normalizedValue
  }

  const handleNameChange = (e) => {
    dispatch(
      editArtworkx({
        currentArtworkId,
        property: 'name',
        value: e.target.value,
      }),
    )
  }

  const handleAlignChange = (alignment, wallWidth, wallHeight) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    const artworkWidth = currentEdited.canvas.width
    const artworkHeight = currentEdited.canvas.height
    const artworkX = currentEdited.canvas.x
    const artworkY = currentEdited.canvas.y
    const factor = 100

    let newX = artworkX
    let newY = artworkY

    switch (alignment) {
      case 'horizontalLeft':
        newX = 0
        break
      case 'horizontalCenter':
        newX = (wallWidth * factor) / 2 - artworkWidth / 2
        break
      case 'horizontalRight':
        newX = wallWidth * factor - artworkWidth
        break
      case 'verticalTop':
        newY = 0
        break
      case 'verticalCenter':
        newY = (wallHeight * factor) / 2 - artworkHeight / 2
        break
      case 'verticalBottom':
        newY = wallHeight * factor - artworkHeight
        break
      default:
        break
    }

    const artworkPosition = { x: newX, y: newY }

    dispatch(
      editAlignArtwork({
        currentArtworkId,
        artworkPosition,
      }),
    )

    if (boundingData) {
      const new3DCoordinate = convert2DTo3D(
        {
          x: newX,
          y: newY,
          size: {
            w: artworkWidth,
            h: artworkHeight,
          },
        },
        boundingData,
      )

      dispatch(
        edit3DCoordinates({
          currentArtworkId,
          serialized3DCoordinate: new3DCoordinate,
        }),
      )
    }
  }

  const handleMoveXChange = (e) => {
    const newX = sanitizeNumberInput(e.target.value)

    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    const artworkWidth = currentEdited.canvas.width
    const artworkHeight = currentEdited.canvas.height
    const artworkY = currentEdited.canvas.y

    dispatch(
      editArtwork({
        currentArtworkId,
        newArtworkSizes: { ...currentEdited.canvas, x: newX },
      }),
    )

    if (boundingData) {
      const new3DCoordinate = convert2DTo3D(
        {
          x: newX,
          y: artworkY,
          size: {
            w: artworkWidth,
            h: artworkHeight,
          },
        },
        boundingData,
      )

      dispatch(
        edit3DCoordinates({
          currentArtworkId,
          serialized3DCoordinate: new3DCoordinate,
        }),
      )
    }
  }

  const handleMoveYChange = (e) => {
    const newY = sanitizeNumberInput(e.target.value)

    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    const artworkWidth = currentEdited.canvas.width
    const artworkHeight = currentEdited.canvas.height
    const artworkX = currentEdited.canvas.x

    dispatch(
      editArtwork({
        currentArtworkId,
        newArtworkSizes: { ...currentEdited.canvas, y: newY },
      }),
    )

    if (boundingData) {
      const new3DCoordinate = convert2DTo3D(
        {
          x: artworkX,
          y: newY,
          size: {
            w: artworkWidth,
            h: artworkHeight,
          },
        },
        boundingData,
      )

      dispatch(
        edit3DCoordinates({
          currentArtworkId,
          serialized3DCoordinate: new3DCoordinate,
        }),
      )
    }
  }

  const handleWidthChange = (e) => {
    const newWidth = sanitizeNumberInput(e.target.value)

    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    const { x, width: currentWidth } = currentEdited.canvas
    const newX = x + (currentWidth - newWidth) / 2

    dispatch(
      editArtwork({
        currentArtworkId,
        newArtworkSizes: { ...currentEdited.canvas, width: newWidth, x: newX },
      }),
    )
  }

  const handleHeightChange = (e) => {
    const newHeight = sanitizeNumberInput(e.target.value)

    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    const { y, height: currentHeight } = currentEdited.canvas
    const newY = y + (currentHeight - newHeight) / 2

    dispatch(
      editArtwork({
        currentArtworkId,
        newArtworkSizes: { ...currentEdited.canvas, height: newHeight, y: newY },
      }),
    )
  }

  return {
    handleNameChange,
    handleAlignChange,
    handleMoveXChange,
    handleMoveYChange,
    handleWidthChange,
    handleHeightChange,
  }
}
