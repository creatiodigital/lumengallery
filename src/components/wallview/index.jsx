import { useSelector, useDispatch } from 'react-redux'

import { Wall } from '@/components/wallview/Wall/Wall'
import { setPanPosition } from '@/lib/features/wallViewSlice'

import styles from './WallView.module.scss'

export const WallView = () => {
  const dispatch = useDispatch()
  const panPosition = useSelector((state) => state.wallView.panPosition)
  const scaleFactor = useSelector((state) => state.wallView.scaleFactor)
  const handleWheel = (e) => {
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

  return (
    <div className={styles.wallView} onWheel={handleWheel}>
      <div
        id="wallWrapper"
        className={styles.wallWrapper}
        style={{
          transform: `translate(${panPosition.x}%, ${panPosition.y}%) scale(${scaleFactor || 1})`,
        }}
      >
        <Wall scaleFactor={scaleFactor} />
      </div>
    </div>
  )
}
