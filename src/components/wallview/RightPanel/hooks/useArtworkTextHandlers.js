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
} from '@/lib/features/artistSlice'

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

  const handleTextFontSizeSelect = (fontSize) => {
    dispatch(editArtworkTextFontSize({ currentArtworkId, fontSize }))
  }

  const handleTextLineHeightSelect = (lineHeight) => {
    dispatch(editArtworkTextLineHeight({ currentArtworkId, lineHeight }))
  }

  const handleTextFontWeightSelect = (fontWeight) => {
    dispatch(editArtworkTextFontWeight({ currentArtworkId, fontWeight }))
  }

  const handleTextFontFamilySelect = (fontFamily) => {
    dispatch(editArtworkTextFontFamily({ currentArtworkId, fontFamily }))
  }

  const handleTextLetterSpacingSelect = (letterSpacing) => {
    dispatch(editArtworkTextLetterSpacing({ currentArtworkId, letterSpacing }))
  }

  return {
    handleArtisticTextChange,
    handleTextAlign,
    handleTextFontSizeSelect,
    handleTextLineHeightSelect,
    handleTextFontWeightSelect,
    handleTextLetterSpacingSelect,
    handleTextFontFamilySelect,
    handleTextColorSelect,
  }
}
