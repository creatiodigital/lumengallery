import { useDispatch } from 'react-redux'

import {
  editArtworkArtisticText,
  editArtworkTextAlign,
  editArtworkTextColor,
  editArtworkTextFontSize,
  editArtworkTextLineHeight,
  editArtworkTextFontWeight,
  editArtworkTextLetterSpacing,
  editArtworkTextFontFamily,
  editArtworkText,
} from '@/lib/features/artworksSlice'

export const useArtworkTextHandlers = (currentArtworkId) => {
  const dispatch = useDispatch()

  const handleArtisticTextChange = (e) => {
    const newArtisticText = e.target.value

    dispatch(editArtworkArtisticText({ currentArtworkId, artisticText: newArtisticText }))
  }

  const handleTextAlign = (textAlign) => {
    dispatch(editArtworkTextAlign({ currentArtworkId, textAlign }))
  }

  const handleTextColorSelect = (color) => {
    dispatch(editArtworkTextColor({ currentArtworkId, color }))
  }

  const handleEditArtworkText = (property, value) => {
    dispatch(editArtworkText({ currentArtworkId, property, value }))
  }

  return {
    handleArtisticTextChange,
    handleTextAlign,
    handleTextColorSelect,
    handleEditArtworkText,
  }
}
