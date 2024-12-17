import { useDispatch, useSelector } from 'react-redux'
import { editArtwork, editArtworkName, editArtworkAuthor } from '@/lib/features/artistSlice'

export const useArtworkHandlers = (currentArtworkId) => {
  const dispatch = useDispatch()
  const artworks = useSelector((state) => state.artist.artworks)

  const handleWidthChange = (e) => {
    const inputValue = e.target.value.trim()
    const newWidth = inputValue === '' ? 0 : Math.round(parseFloat(inputValue))

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
    const inputValue = e.target.value.trim()
    const newHeight = inputValue === '' ? 0 : Math.round(parseFloat(inputValue))

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
    const inputValue = e.target.value.trim()
    const newX = inputValue === '' ? 0 : Math.round(parseFloat(inputValue))

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
    const inputValue = e.target.value.trim()
    const newY = inputValue === '' ? 0 : Math.round(parseFloat(inputValue))

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

  const handleAuthorChange = (e) => {
    const newAuthor = e.target.value

    dispatch(editArtworkAuthor({ currentArtworkId, author: newAuthor }))
  }

  return {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
    handleAuthorChange,
    handleMoveXChange,
    handleMoveYChange,
  }
}
