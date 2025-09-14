import React, { memo } from 'react'

import styles from './Measurements.module.scss'

type MeasurementsProps = {
  width: string
  height: string
}

const Measurements = memo(({ width, height }: MeasurementsProps) => (
  <>
    <span className={styles.width}>{`${width} m`}</span>
    <span className={styles.height}>{`${height} m`}</span>
  </>
))

Measurements.displayName = 'Measurements'

export default Measurements
