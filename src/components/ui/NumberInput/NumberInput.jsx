import c from 'classnames'
import React from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './NumberInput.module.scss'

function NumberInput({ type, value, onChange, icon, rotate, max, min }) {
  return (
    <div className={styles.wrapper}>
      <input
        type="number"
        className={c([styles.input, styles[type], { [styles.withIcon]: !!icon }])}
        value={value}
        min={min}
        max={max}
        step={0.01}
        onChange={onChange}
      />
      <div className={c(styles.icon, { [styles[`rotate${rotate}`]]: !!rotate })}>
        <Icon name={icon} size={16} color="#444444" />
      </div>
    </div>
  )
}

export default NumberInput
