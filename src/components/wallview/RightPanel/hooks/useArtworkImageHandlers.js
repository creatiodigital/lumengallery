import { useDispatch, useSelector } from 'react-redux'

import { editArtwork, editArtisticImage } from '@/lib/features/artworksSlice'

export const useArtworkImageHandlers = (currentArtworkId) => {
  const dispatch = useDispatch()
  const artworks = useSelector((state) => state.artworks.artworks)

  const handleEditArtworkx = (property, value) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
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
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
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
    handleEditArtworkx,
    handleEditArtisticImage,
  }
}
