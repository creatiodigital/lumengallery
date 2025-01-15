import React, { memo } from 'react'

import styles from './Measurements.module.scss'

const Measurements = memo(({ width, height }) => (
  <>
    <span className={styles.width}>{`${width} m`}</span>
    <span className={styles.height}>{`${height} m`}</span>
  </>
))

Measurements.displayName = 'Measurements'

export default Measurements
