import { useDispatch, useSelector } from 'react-redux'

import { editArtwork, editArtisticImage } from '@/redux/slices/artworksSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

export const useArtworkImageHandlers = (currentArtworkId: string) => {
  const dispatch = useDispatch()
  const artworksById = useSelector((state: RootState) => state.artworks.byId)

  const handleEditArtwork = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    dispatch(
      editArtwork({
        currentArtworkId,
        property,
        value,
      }),
    )
  }

  const handleEditArtisticImage = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    dispatch(
      editArtisticImage({
        currentArtworkId,
        property,
        value,
      }),
    )
  }

  return {
    handleEditArtwork,
    handleEditArtisticImage,
  }
}
