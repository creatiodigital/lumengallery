import c from 'classnames'
import type { MouseEventHandler } from 'react'

import styles from './Button.module.scss'

type ButtonProps = {
  variant?: 'primary' | 'outline' | 'small'
  type?: 'submit' | 'button' | 'reset'
  onClick?: MouseEventHandler<HTMLButtonElement>
  label: string
}

export const Button = ({ variant = 'primary', type = 'button', onClick, label }: ButtonProps) => {
  return (
    <button className={c([styles.button, styles[variant]])} onClick={onClick} type={type}>
      {label}
    </button>
  )
}

export default Button
