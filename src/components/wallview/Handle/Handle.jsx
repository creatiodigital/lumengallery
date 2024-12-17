import c from 'classnames'
import React from 'react'

import styles from './Handle.module.scss'

const Handle = ({ direction, onMouseDown }) => (
  <div className={c([styles.handle, styles[direction]])} onMouseDown={onMouseDown} />
)

export default Handle
