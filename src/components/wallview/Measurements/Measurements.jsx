import React from 'react'

import styles from './Measurements.module.scss'

const Measurements = ({ width, height }) => (
  <>
    <span className={styles.width}>{`${width} M`}</span>
    <span className={styles.height}>{`${height} M`}</span>
  </>
)

export default Measurements
