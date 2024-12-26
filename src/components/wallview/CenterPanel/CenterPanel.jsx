import { useSelector, useDispatch } from 'react-redux'

import { useDeselectArtwork } from '@/components/wallview/hooks/useDeselectArtwork'
import { Wall } from '@/components/wallview/Wall/Wall'
import { setPanPosition } from '@/lib/features/wallViewSlice'

import styles from './CenterPanel.module.scss'

export const CenterPanel = () => {
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

  const handleDeselect = useDeselectArtwork()

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
