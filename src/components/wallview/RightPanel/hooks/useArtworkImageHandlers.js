import { useDispatch, useSelector } from 'react-redux'

import {
  editArtworkYear,
  editArtworkDimensions,
  editArtworkAuthor,
  editArtworkTitle,
  editArtworkDescription,
  showArtworkFrame,
  showArtworkPassepartout,
  showArtworkInformation,
  editArtworkFrameColor,
  editArtworkPassepartoutColor,
  editArtworkFrameThickness,
  editArtworkPassepartoutThickness,
} from '@/lib/features/artworksSlice'

export const useArtworkImageHandlers = (currentArtworkId) => {
  const dispatch = useDispatch()
  const artworks = useSelector((state) => state.artworks.artworks)

  const handleAuthorChange = (e) => {
    const newAuthor = e.target.value

    dispatch(editArtworkAuthor({ currentArtworkId, author: newAuthor }))
  }

  const handleArtworkTitleChange = (e) => {
    const newTitle = e.target.value

    dispatch(editArtworkTitle({ currentArtworkId, artworkTitle: newTitle }))
  }

  const handleArtworkYearChange = (e) => {
    const newYear = e.target.value

    dispatch(editArtworkYear({ currentArtworkId, artworkYear: newYear }))
  }

  const handleDescriptionChange = (e) => {
    const newDescription = e.target.value

    dispatch(editArtworkDescription({ currentArtworkId, description: newDescription }))
  }

  const handleArtworkDimensionsChange = (e) => {
    const newDimensions = e.target.value

    dispatch(editArtworkDimensions({ currentArtworkId, artworkDimensions: newDimensions }))
  }

  const handleShowFrame = (showFrame) => {
    const currentEdited = artworks?.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      showArtworkFrame({
        currentArtworkId,
        showFrame,
      }),
    )
  }

  const handleShowPassepartout = (showPassepartout) => {
    const currentEdited = artworks?.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      showArtworkPassepartout({
        currentArtworkId,
        showPassepartout,
      }),
    )
  }

  const handleShowInformation = (showInformation) => {
    const currentEdited = artworks?.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      showArtworkInformation({
        currentArtworkId,
        showInformation,
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

  const handlePassepartoutColorSelect = (passepartoutColor) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      editArtworkPassepartoutColor({
        currentArtworkId,
        passepartoutColor,
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

  const handlePassepartoutThicknessSelect = (passepartoutThickness) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      editArtworkPassepartoutThickness({
        currentArtworkId,
        passepartoutThickness,
      }),
    )
  }

  return {
    handleAuthorChange,
    handleArtworkTitleChange,
    handleArtworkYearChange,
    handleDescriptionChange,
    handleArtworkDimensionsChange,
    handleShowFrame,
    handleShowPassepartout,
    handleShowInformation,
    handleFrameColorSelect,
    handlePassepartoutColorSelect,
    handleFrameThicknessSelect,
    handlePassepartoutThicknessSelect,
  }
}
