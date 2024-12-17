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

  const sanitizeInput = (value) => {
    const parsedValue = parseFloat(value.trim())
    return isNaN(parsedValue) || parsedValue < 0 ? 0 : Math.round(parsedValue)
  }

  const handleWidthChange = (e) => {
    const newWidth = sanitizeInput(e.target.value)

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
    const newHeight = sanitizeInput(e.target.value)

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
    const newX = sanitizeInput(e.target.value)

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
    const newY = sanitizeInput(e.target.value)

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
