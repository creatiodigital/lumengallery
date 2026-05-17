'use client'

import { memo } from 'react'
import { useSelector } from 'react-redux'

import { WALL_SCALE } from '@/components/wallview/constants'
import { Text } from '@/components/ui/Typography'
import type { RootState } from '@/redux/store'

import styles from './ArtworkMeasurements.module.scss'

type ArtworkMeasurementsProps = {
  width2d: number
  height2d: number
}

const ArtworkMeasurements = memo(({ width2d, height2d }: ArtworkMeasurementsProps) => {
  const isDragging = useSelector((state: RootState) => state.wallView.isDragging)

  // Hide measurements during drag (distance lines show instead)
  // Keep visible during resize so user can see size changes
  if (isDragging) return null

  // Convert from 2D scale to cm (right panel displays cm; keep these consistent)
  const widthCm = Math.round((width2d / WALL_SCALE) * 100)
  const heightCm = Math.round((height2d / WALL_SCALE) * 100)

  return (
    <>
      <Text font="dashboard" as="span" size="sm" className={styles.width}>
        {`${widthCm} cm`}
      </Text>
      <Text font="dashboard" as="span" size="sm" className={styles.height}>
        {`${heightCm} cm`}
      </Text>
    </>
  )
})

ArtworkMeasurements.displayName = 'ArtworkMeasurements'

export { ArtworkMeasurements }
export default ArtworkMeasurements
