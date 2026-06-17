'use client'

import c from 'classnames'
import type { ChangeEventHandler } from 'react'

import styles from './Textarea.module.scss'

type TTextarea = {
  id?: string
  value: string
  onChange: ChangeEventHandler<HTMLTextAreaElement>
  placeholder?: string
  rows?: number
  size?: 'regular' | 'medium'
  className?: string
  /** Mark the field invalid: red border + `aria-invalid`. */
  invalid?: boolean
}

function Textarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
  size = 'regular',
  className,
  invalid,
}: TTextarea) {
  return (
    <div className={c(styles.wrapper, className)}>
      <textarea
        id={id}
        className={c(styles.textarea, styles[size], { [styles.invalid]: invalid })}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={invalid || undefined}
      />
    </div>
  )
}

export default Textarea
