import { useDispatch, useSelector } from 'react-redux'

import { editArtisticText } from '@/lib/features/artworksSlice'

export const useArtisticText = (artworkId) => {
  const dispatch = useDispatch()

  const byId = useSelector((state) => state.artworks.byId)
  const artwork = byId[artworkId]

  const textContent = artwork?.artisticTextProperties?.textContent
  const textAlign = artwork?.artisticTextProperties?.textAlign || 'left'
  const textColor = artwork?.artisticTextProperties?.textColor
  const fontSize = artwork?.artisticTextProperties?.fontSize.value
  const lineHeight = artwork?.artisticTextProperties?.lineHeight.value
  const fontFamily = artwork?.artisticTextProperties?.fontFamily.value
  const fontWeight = artwork?.artisticTextProperties?.fontWeight.value
  const letterSpacing = artwork?.artisticTextProperties?.letterSpacing.value

  const handleArtisticTextChange = (updatedText) => {
    if (!artworkId) return

    dispatch(
      editArtisticText({
        currentArtworkId: artworkId,
        property: 'textContent',
        value: updatedText,
      }),
    )
  }

  return {
    textContent,
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
