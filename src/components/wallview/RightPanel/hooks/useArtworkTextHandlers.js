import { useDispatch } from 'react-redux'

import { editArtisticText } from '@/redux/slices/artworksSlice'

export const useArtworkTextHandlers = (currentArtworkId) => {
  const dispatch = useDispatch()

  const handleEditArtworkText = (property, value) => {
    dispatch(editArtisticText({ currentArtworkId, property, value }))
  }

  return {
    handleEditArtworkText,
  }
}
