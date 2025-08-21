import c from 'classnames'
import type { ChangeEventHandler, FocusEventHandler, KeyboardEventHandler } from 'react'

import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/components/ui/Icon'

import styles from './Input.module.scss'

type InputProps = {
  variant?: string
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  icon: IconName
  rotate?: number
  onBlur?: FocusEventHandler<HTMLInputElement>
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  autoFocus: boolean
}

const Input = ({
  variant,
  value,
  onChange,
  icon,
  rotate,
  onBlur,
  onKeyDown,
  autoFocus = false,
}: InputProps) => {
  return (
    <div className={styles.wrapper}>
      <input
        type="text"
        className={c([styles.input, variant && styles[variant], { [styles.withIcon]: !!icon }])}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
      />
      {icon && (
        <div className={c(styles.icon, { [styles[`rotate${rotate}`]]: !!rotate })}>
          <Icon name={icon} size={16} color="#444444" />
        </div>
      )}
    </div>
  )
}

export default Input
