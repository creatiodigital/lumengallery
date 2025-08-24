import { useDispatch, useSelector } from 'react-redux'

import { editArtisticText } from '@/redux/slices/artworksSlice'

export const useArtisticText = (artworkId) => {
  const dispatch = useDispatch()
  const byId = useSelector((state) => state.artworks.byId)
  const artwork = byId[artworkId]

  const {
    textContent,
    textAlign,
    textColor,
    fontSize,
    lineHeight,
    fontFamily,
    fontWeight,
    letterSpacing,
  } = artwork.artisticTextProperties

  const handleArtisticTextChange = (updatedText) => {
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
    fontSize: fontSize.value,
    lineHeight: lineHeight.value,
    fontFamily: fontFamily.value,
    fontWeight: fontWeight.value,
    letterSpacing: letterSpacing.value,
    handleArtisticTextChange,
  }
}
