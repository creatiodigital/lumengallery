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
  const fontSize = artwork?.artisticTextStyles?.fontSize || 16
  const lineHeight = artwork?.artisticTextStyles?.lineHeight || 1
  const fontFamily = artwork?.artisticTextStyles?.fontFamily || 'Roboto'
  const fontWeight = artwork?.artisticTextStyles?.fontWeight || 'Regular'
  const letterSpacing = artwork?.artisticTextStyles?.letterSpacing || 1

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
    fontSize,
    lineHeight,
    fontFamily,
    fontWeight,
    letterSpacing,
    handleArtisticTextChange,
  }
}
