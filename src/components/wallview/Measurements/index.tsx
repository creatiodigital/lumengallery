'use client'

import { memo } from 'react'
import { WALL_SCALE } from '@/components/wallview/constants'
import { Text } from '@/components/ui/Typography'

import styles from './Measurements.module.scss'

type MeasurementsProps = {
  width: string
  height: string
  floorOffset?: number // Floor offset in meters
}

const Measurements = memo(({ width, height, floorOffset = 0 }: MeasurementsProps) => {
  // width/height arrive as cm strings; floorOffset is meters from the boundingData.
  const totalHeightCm = Math.round(parseFloat(height) + floorOffset * 100)

  return (
    <>
      <Text font="dashboard" as="span" size="lg" className={styles.width}>{`${width} cm`}</Text>
      <Text
        font="dashboard"
        as="span"
        size="lg"
        className={styles.height}
        style={
          floorOffset > 0
            ? {
                top: `calc(50% + ${(floorOffset * WALL_SCALE) / 2}px)`, // Shift down by half the offset to stay centered on total height
              }
            : undefined
        }
      >{`${totalHeightCm} cm`}</Text>
    </>
  )
})

Measurements.displayName = 'Measurements'

export { Measurements }
export default Measurements
