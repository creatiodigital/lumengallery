import { useDispatch, useSelector } from 'react-redux'

import { editArtwork, editArtisticImage } from '@/app/redux/slices/artworksSlice'

export const useArtworkImageHandlers = (currentArtworkId) => {
  const dispatch = useDispatch()
  const artworksById = useSelector((state) => state.artworks.byId)

  const handleEditArtwork = (property, value) => {
    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    dispatch(
      editArtwork({
        currentArtworkId,
        property,
        value,
      }),
    )
  }

  const handleEditArtisticImage = (property, value) => {
    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    dispatch(
      editArtisticImage({
        currentArtworkId,
        property,
        value,
      }),
    )
  }

  return {
    handleEditArtwork,
    handleEditArtisticImage,
  }
}
