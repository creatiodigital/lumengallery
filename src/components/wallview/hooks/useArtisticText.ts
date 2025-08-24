import { useDispatch, useSelector } from 'react-redux'

import { editArtisticText } from '@/redux/slices/artworksSlice'
import type { RootState } from '@/redux/store'
import type { TArtisticText } from '@/types/artwork'

export const useArtisticText = (artworkId: string) => {
  const dispatch = useDispatch()
  const byId = useSelector((state: RootState) => state.artworks.byId)
  const artwork = byId[artworkId] as TArtisticText | undefined

  if (!artwork) {
    throw new Error(`No artwork found for id ${artworkId}`)
  }

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

  const handleArtisticTextChange = (updatedText: string) => {
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
