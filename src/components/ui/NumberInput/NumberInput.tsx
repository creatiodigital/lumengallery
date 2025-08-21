import c from 'classnames'
import React from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'

import styles from './NumberInput.module.scss'

type NumberInputProps = {
  variant?: string
  value: number
  onChange: React.ChangeEventHandler<HTMLInputElement>
  icon?: IconName
  rotate?: number
  max?: number
  min?: number
}

const NumberInput = ({ variant, value, onChange, icon, rotate, max, min }: NumberInputProps) => {
  return (
    <div className={styles.wrapper}>
      <input
        type="number"
        className={c([styles.input, variant && styles[variant], { [styles.withIcon]: !!icon }])}
        value={value}
        min={min}
        max={max}
        step={0.01}
        onChange={onChange}
      />
      {icon && (
        <div className={c(styles.icon, { [styles[`rotate${rotate}`]]: !!rotate })}>
          <Icon name={icon} size={16} color="#444444" />
        </div>
      )}
    </div>
  )
}

export default NumberInput
