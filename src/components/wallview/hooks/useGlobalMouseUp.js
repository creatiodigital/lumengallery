import { useEffect } from 'react'

export const useGlobalMouseUp = (dragging, setDragging) => {
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragging) {
        setDragging(false)
      }
    }

    if (dragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [dragging, setDragging])
}
