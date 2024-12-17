import c from 'classnames'
import React from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './Input.module.scss'

function Input({ type, value, onChange, icon, rotate }) {
  return (
    <div className={styles.wrapper}>
      <input
        type="text"
        className={c([styles.input, styles[type], { [styles.withIcon]: !!icon }])}
        value={value}
        onChange={onChange}
      />
      <div className={c(styles.icon, { [styles[`rotate${rotate}`]]: !!rotate })}>
        <Icon name={icon} size={16} color="#444444" />
      </div>
    </div>
  )
}

export default Input
