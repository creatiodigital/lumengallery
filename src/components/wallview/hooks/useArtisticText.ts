import { useDispatch, useSelector } from 'react-redux'

import { editArtisticText } from '@/redux/slices/artworksSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

export const useArtisticText = (artworkId: string) => {
  const dispatch = useDispatch()
  const byId = useSelector((state: RootState) => state.artworks.byId)
  const artwork = byId[artworkId] as TArtwork | undefined

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
  } = artwork

  const handleArtisticTextChange = (updatedText: string) => {
    dispatch(
      editArtisticText({
        currentArtworkId: artworkId,
        property: 'textContent',
        value: updatedText,
      }),
    )
  }

  if (!fontSize || !lineHeight || !fontFamily || !fontWeight || !letterSpacing) {
    return null // or fallback UI
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
