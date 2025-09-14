import { useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { useDeselectArtwork } from '@/components/wallview/hooks/useDeselectArtwork'
import { Wall } from '@/components/wallview/Wall/Wall'
import {
  increaseScaleFactor,
  decreaseScaleFactor,
  setPanPosition,
} from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './CenterPanel.module.scss'

export const CenterPanel = () => {
  const dispatch = useDispatch()
  const containerRef = useRef<HTMLDivElement>(null)
  const panPosition = useSelector((state: RootState) => state.wallView.panPosition)
  const scaleFactor = useSelector((state: RootState) => state.wallView.scaleFactor)
  const { handleDeselect } = useDeselectArtwork()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.style.overscrollBehavior = 'contain'
    el.style.touchAction = 'none'

    const handleWheel = (e: WheelEvent) => {
      if (e.cancelable) e.preventDefault()

      if (e.metaKey || e.ctrlKey) {
        if (e.deltaY < 0) dispatch(increaseScaleFactor())
        else if (e.deltaY > 0) dispatch(decreaseScaleFactor())
        return
      }

      const scrollSpeedFactor = 0.4
      const deltaX = e.deltaX * scrollSpeedFactor
      const deltaY = e.deltaY * scrollSpeedFactor

      const { clientWidth, clientHeight } = el

      dispatch(
        setPanPosition({
          deltaX: -deltaX / clientWidth,
          deltaY: -deltaY / clientHeight,
        }),
      )
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [dispatch])

  return (
    <div ref={containerRef} className={styles.panel}>
      <div
        id="wallWrapper"
        className={styles.wrapper}
        onClick={handleDeselect}
        style={{
          transform: `translate(${panPosition.x}%, ${panPosition.y}%) scale(${scaleFactor || 1})`,
        }}
      >
        <Wall />
      </div>
    </div>
  )
}

export default CenterPanel
