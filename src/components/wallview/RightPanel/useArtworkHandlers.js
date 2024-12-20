import { useDispatch, useSelector } from 'react-redux'

import {
  editArtwork,
  editArtworkName,
  editArtworkAuthor,
  editArtworkDescription,
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

  return {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
    handleAuthorChange,
    handleDescriptionChange,
    handleMoveXChange,
    handleMoveYChange,
  }
}
