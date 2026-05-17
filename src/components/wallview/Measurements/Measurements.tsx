'use client'

import { memo } from 'react'

import styles from './Measurements.module.scss'

type MeasurementsProps = {
  width: string
  height: string
}

const Measurements = memo(({ width, height }: MeasurementsProps) => (
  <>
    <span className={styles.width}>{`${width} cm`}</span>
    <span className={styles.height}>{`${height} cm`}</span>
  </>
))

Measurements.displayName = 'Measurements'

export default Measurements
