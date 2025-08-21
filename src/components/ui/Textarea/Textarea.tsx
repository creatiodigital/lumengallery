import type { ChangeEventHandler } from 'react'

import styles from './Textarea.module.scss'

type TextareaProps = {
  value: string
  onChange: ChangeEventHandler<HTMLElement>
}

function Textarea({ value, onChange }: TextareaProps) {
  return (
    <div className={styles.wrapper}>
      <textarea className={styles.textarea} value={value} onChange={onChange} />
    </div>
  )
}

export default Textarea
