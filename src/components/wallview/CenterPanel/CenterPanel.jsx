import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { useDeselectArtwork } from '@/components/wallview/hooks/useDeselectArtwork'
import { Wall } from '@/components/wallview/Wall/Wall'
import {
  increaseScaleFactor,
  decreaseScaleFactor,
  setPanPosition,
} from '@/redux/slices/wallViewSlice'

import styles from './CenterPanel.module.scss'

export const CenterPanel = () => {
  const dispatch = useDispatch()
  const panPosition = useSelector((state) => state.wallView.panPosition)
  const scaleFactor = useSelector((state) => state.wallView.scaleFactor)
  const handleWheel = (e) => {
    if (e.metaKey) {
      e.preventDefault()
      return
    }
    const scrollSpeedFactor = 0.4
    const deltaX = -e.deltaX * scrollSpeedFactor
    const deltaY = -e.deltaY * scrollSpeedFactor

    dispatch(
      setPanPosition({
        deltaX: deltaX / window.innerWidth,
        deltaY: deltaY / window.innerHeight,
      }),
    )
  }

  const { handleDeselect } = useDeselectArtwork()

  useEffect(() => {
    const handleWheelZoom = (event) => {
      if (event.metaKey) {
        event.preventDefault()
        if (event.deltaY < 0) {
          dispatch(increaseScaleFactor())
        } else if (event.deltaY > 0) {
          dispatch(decreaseScaleFactor())
        }
      }
    }

    window.addEventListener('wheel', handleWheelZoom, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheelZoom)
    }
  }, [dispatch])

  return (
    <div className={styles.panel} onWheel={handleWheel}>
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
