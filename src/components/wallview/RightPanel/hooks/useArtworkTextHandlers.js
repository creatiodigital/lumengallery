import { useDispatch } from 'react-redux'

import {
  editArtworkArtisticText,
  editArtworkTextAlign,
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

  const handleEditArtworkText = (property, value) => {
    dispatch(editArtworkText({ currentArtworkId, property, value }))
  }

  return {
    handleArtisticTextChange,
    handleTextAlign,
    handleEditArtworkText,
  }
}
