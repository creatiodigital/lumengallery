import c from 'classnames'
import React from 'react'

import styles from './Button.module.scss'

function Button({ type, onClick, label }) {
  return (
    <button className={c([styles.button, styles[type]])} onClick={onClick}>
      {label}
    </button>
  )
}

export default Button
