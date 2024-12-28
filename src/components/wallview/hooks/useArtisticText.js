import { useDispatch, useSelector } from 'react-redux'

import { editArtworkArtisticText } from '@/lib/features/artistSlice'

export const useArtisticText = (artworkId) => {
  const dispatch = useDispatch()

  const artwork = useSelector((state) =>
    state.artist.artworks.find((artwork) => artwork.id === artworkId),
  )

  const artisticText = artwork?.artisticText || ''
  const textAlign = artwork?.artisticTextStyles?.textAlign || 'left'
  const textColor = artwork?.artisticTextStyles?.color || '#000000'

  const handleArtisticTextChange = (updatedText) => {
    if (!artworkId) return

    dispatch(
      editArtworkArtisticText({
        currentArtworkId: artworkId,
        artisticText: updatedText,
      }),
    )
  }

  return {
    artisticText,
    textAlign,
    textColor,
    handleArtisticTextChange,
  }
}
