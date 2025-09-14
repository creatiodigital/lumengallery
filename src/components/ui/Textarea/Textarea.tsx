import type { ChangeEventHandler } from 'react'

import styles from './Textarea.module.scss'

type TTextarea = {
  value: string
  onChange: ChangeEventHandler<HTMLTextAreaElement>
}

function Textarea({ value, onChange }: TTextarea) {
  return (
    <div className={styles.wrapper}>
      <textarea className={styles.textarea} value={value} onChange={onChange} />
    </div>
  )
}

export default Textarea
