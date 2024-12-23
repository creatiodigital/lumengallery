import { useEffect } from 'react'
import { useDispatch } from 'react-redux'

import { deleteArtwork } from '@/lib/features/artistSlice'

export const useKeyboardEvents = (currentArtworkId, isMouseOver) => {
  const dispatch = useDispatch()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && currentArtworkId && isMouseOver) {
        dispatch(deleteArtwork({ artworkId: currentArtworkId }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentArtworkId, isMouseOver, dispatch])
}
