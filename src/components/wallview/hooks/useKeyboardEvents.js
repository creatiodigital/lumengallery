import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { deleteArtwork } from '@/lib/features/artistSlice'

export const useKeyboardEvents = (currentArtworkId, isMouseOver) => {
  const dispatch = useDispatch()
  const isEditingArtwork = useSelector((state) => state.dashboard.isEditingArtwork)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isEditingArtwork) {
        // Skip deletion logic if editing artwork
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && currentArtworkId && isMouseOver) {
        dispatch(deleteArtwork({ artworkId: currentArtworkId }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentArtworkId, isMouseOver, isEditingArtwork, dispatch])
}
