import { useDispatch } from 'react-redux'

import {
  editArtworkArtisticText,
  editArtworkTextAlign,
  editArtisticText,
} from '@/lib/features/artworksSlice'

export const useArtworkTextHandlers = (currentArtworkId) => {
  const dispatch = useDispatch()

  const handleArtisticTextChange = (e) => {
    const newTextContent = e.target.value

    dispatch(editArtworkArtisticText({ currentArtworkId, textContent: newTextContent }))
  }

  const handleTextAlign = (textAlign) => {
    dispatch(editArtworkTextAlign({ currentArtworkId, textAlign }))
  }

  const handleEditArtworkText = (property, value) => {
    dispatch(editArtisticText({ currentArtworkId, property, value }))
  }

  return {
    handleArtisticTextChange,
    handleTextAlign,
    handleEditArtworkText,
  }
}
