import { useDispatch } from 'react-redux'

import { editArtisticText } from '@/redux/slices/artworksSlice'
import type { TArtwork } from '@/types/artwork'

export const useArtworkTextHandlers = (currentArtworkId: string) => {
  const dispatch = useDispatch()

  const handleEditArtworkText = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
    dispatch(editArtisticText({ currentArtworkId, property, value }))
  }

  return {
    handleEditArtworkText,
  }
}
