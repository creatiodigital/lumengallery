import { useDispatch, useSelector } from 'react-redux'

import { editArtworkx, editArtisticImage } from '@/lib/features/artworksSlice'

export const useArtworkImageHandlers = (currentArtworkId) => {
  const dispatch = useDispatch()
  const artworks = useSelector((state) => state.artworks.artworks)

  const handleEditArtworkx = (property, value) => {
    const currentEdited = artworks.find((artwork) => artwork.id === currentArtworkId)
    if (!currentEdited) return

    dispatch(
      editArtworkx({
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
