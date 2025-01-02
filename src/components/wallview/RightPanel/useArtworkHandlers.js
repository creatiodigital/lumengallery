import { useDispatch, useSelector } from 'react-redux'
import { convert2DTo3D } from '../utils'

import {
  edit3DCoordinates,
  editArtwork,
  editAlignArtwork,
  editArtworkName,
  editArtworkAuthor,
  editArtworkDescription,
  editArtworkArtisticText,
  editArtworkTextAlign,
  editArtworkTextColor,
  editArtworkTextFontSize,
  editArtworkTextLineHeight,
  editArtworkTextFontWeight,
  editArtworkTextLetterSpacing,
  editArtworkTextFontFamily,
  showArtworkFrame,
  editArtworkFrameColor,
  editArtworkFrameThickness,
} from '@/lib/features/artistSlice'

export const useArtworkHandlers = (currentArtworkId, boundingData) => {
  const dispatch = useDispatch()
  const artworks = useSelector((state) => state.artist.artworks)

  const sanitizeNumberInput = (value) => {
    const normalizedValue = value * 100
    return normalizedValue
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

  const handleNameChange = (e) => {
    const newName = e.target.value

    dispatch(editArtworkName({ currentArtworkId, name: newName }))
  }

  const handleDescriptionChange = (e) => {
    const newDescription = e.target.value

    dispatch(editArtworkDescription({ currentArtworkId, description: newDescription }))
  }

  const handleAuthorChange = (e) => {
    const newAuthor = e.target.value

    dispatch(editArtworkAuthor({ currentArtworkId, author: newAuthor }))
  }

  const handleArtisticTextChange = (e) => {
    const newArtisticText = e.target.value

    dispatch(editArtworkArtisticText({ currentArtworkId, artisticText: newArtisticText }))
  }

  const handleTextAlign = (textAlign) => {
    dispatch(editArtworkTextAlign({ currentArtworkId, textAlign }))
  }

  const handleTextColorSelect = (color) => {
    dispatch(editArtworkTextColor({ currentArtworkId, color }))
  }

  const handleTextFontSizeSelect = (fontSize) => {
    dispatch(editArtworkTextFontSize({ currentArtworkId, fontSize }))
  }

  const handleTextLineHeightSelect = (lineHeight) => {
    dispatch(editArtworkTextLineHeight({ currentArtworkId, lineHeight }))
  }

  const handleTextFontWeightSelect = (fontWeight) => {
    dispatch(editArtworkTextFontWeight({ currentArtworkId, fontWeight }))
  }

  const handleTextFontFamilySelect = (fontFamily) => {
    dispatch(editArtworkTextFontFamily({ currentArtworkId, fontFamily }))
  }

  const handleTextLetterSpacingSelect = (letterSpacing) => {
    dispatch(editArtworkTextLetterSpacing({ currentArtworkId, letterSpacing }))
  }

  const handleShowFrame = (showFrame) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      showArtworkFrame({
        currentArtworkId,
        showFrame,
      }),
    )
  }

  const handleFrameColorSelect = (frameColor) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      editArtworkFrameColor({
        currentArtworkId,
        frameColor,
      }),
    )
  }

  const handleFrameThicknessSelect = (frameThickness) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      editArtworkFrameThickness({
        currentArtworkId,
        frameThickness,
      }),
    )
  }

  return {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
    handleAuthorChange,
    handleDescriptionChange,
    handleMoveXChange,
    handleMoveYChange,
    handleAlignChange,
    handleArtisticTextChange,
    handleTextAlign,
    handleTextFontSizeSelect,
    handleTextLineHeightSelect,
    handleTextFontWeightSelect,
    handleTextLetterSpacingSelect,
    handleTextFontFamilySelect,
    handleTextColorSelect,
    handleShowFrame,
    handleFrameColorSelect,
    handleFrameThicknessSelect,
  }
}
