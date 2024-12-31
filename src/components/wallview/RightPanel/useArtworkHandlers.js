import { useDispatch, useSelector } from 'react-redux'

import {
  editArtwork,
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
} from '@/lib/features/artistSlice'

export const useArtworkHandlers = (currentArtworkId) => {
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

    dispatch(
      editArtwork({
        currentArtworkId,
        newArtworkSizes: { ...currentEdited.canvas, x: newX },
      }),
    )
  }

  const handleMoveYChange = (e) => {
    const newY = sanitizeNumberInput(e.target.value)

    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      editArtwork({
        currentArtworkId,
        newArtworkSizes: { ...currentEdited.canvas, y: newY },
      }),
    )
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

  return {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
    handleAuthorChange,
    handleDescriptionChange,
    handleMoveXChange,
    handleMoveYChange,
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
  }
}
