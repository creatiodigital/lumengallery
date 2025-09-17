import c from 'classnames'
import React from 'react'
import type { MouseEventHandler } from 'react'

import styles from './Button.module.scss'

type ButtonProps = {
  variant?: 'primary' | 'outline' | 'small'
  type?: 'submit' | 'button' | 'reset'
  onClick?: MouseEventHandler<HTMLButtonElement>
  label: string
}

export const Button = React.memo(
  ({ variant = 'primary', type = 'button', onClick, label }: ButtonProps) => {
    // console.log('Button', label)
    return (
      <button className={c([styles.button, styles[variant]])} onClick={onClick} type={type}>
        {label}
      </button>
    )
  },
)

Button.displayName = 'Button'

export default Button
