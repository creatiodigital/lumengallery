import React from 'react'
import Image from 'next/image'

import styles from './Human.module.scss'

const Human = ({ humanWidth, humanHeight }) => (
  <div className={styles.human}>
    <Image src="/assets/person.png" alt="person" width={humanWidth} height={humanHeight} />
  </div>
)

export default Human
