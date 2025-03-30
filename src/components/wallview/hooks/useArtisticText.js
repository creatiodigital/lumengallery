import { useDispatch, useSelector } from 'react-redux'

import { editArtworkArtisticText } from '@/lib/features/artworksSlice'

export const useArtisticText = (artworkId) => {
  const dispatch = useDispatch()

  const artwork = useSelector((state) =>
    state.artworks.artworks.find((artwork) => artwork.id === artworkId),
  )

  const artisticText = artwork?.artisticText || ''
  const textAlign = artwork?.artisticTextStyles?.textAlign || 'left'
  const textColor = artwork?.artisticTextStyles?.textColor
  const fontSize = artwork?.artisticTextStyles?.fontSize.value
  const lineHeight = artwork?.artisticTextStyles?.lineHeight.value
  const fontFamily = artwork?.artisticTextStyles?.fontFamily.value
  const fontWeight = artwork?.artisticTextStyles?.fontWeight.value
  const letterSpacing = artwork?.artisticTextStyles?.letterSpacing.value

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
