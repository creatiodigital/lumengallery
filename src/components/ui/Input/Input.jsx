import React from 'react'
import c from 'classnames'

import styles from './Input.module.scss'

function Input({ type, value, onChange }) {
  return (
    <input
      type="text"
      className={c([styles.input, styles[type]])}
      value={value}
      onChange={onChange}
    />
  )
}

export default Input
