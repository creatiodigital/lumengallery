import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { deleteArtwork } from '@/lib/features/artistSlice'
import { removeGroup, setShiftKeyDown } from '@/lib/features/wallViewSlice'

export const useKeyboardEvents = (currentArtworkId, isMouseOver) => {
  const dispatch = useDispatch()
  const isEditingArtwork = useSelector((state) => state.dashboard.isEditingArtwork)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isEditingArtwork) {
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && currentArtworkId && isMouseOver) {
        dispatch(deleteArtwork({ artworkId: currentArtworkId }))
        dispatch(removeGroup())
      }

      if (e.key === 'Shift') {
        dispatch(setShiftKeyDown(true))
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        dispatch(setShiftKeyDown(false))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [currentArtworkId, isMouseOver, isEditingArtwork, dispatch])
}
