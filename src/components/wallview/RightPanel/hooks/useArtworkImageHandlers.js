import { useDispatch, useSelector } from 'react-redux'

import {
  editArtworkYear,
  editArtworkDimensions,
  editArtworkAuthor,
  editArtworkTitle,
  editArtworkDescription,
  editArtisticImage,
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

  const handleEditArtisticImage = (property, value) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    console.log('handleEditArtisticImage', property, value)

    dispatch(
      editArtisticImage({
        currentArtworkId,
        property,
        value,
      }),
    )
  }

  return {
    handleAuthorChange,
    handleArtworkTitleChange,
    handleArtworkYearChange,
    handleDescriptionChange,
    handleArtworkDimensionsChange,
    handleEditArtisticImage,
  }
}
