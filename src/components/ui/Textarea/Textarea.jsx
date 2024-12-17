import React from 'react'

import styles from './Textarea.module.scss'

function Textarea({ value, onChange }) {
  return (
    <div className={styles.wrapper}>
      <textarea className={styles.textarea} value={value} onChange={onChange} />
    </div>
  )
}

export default Textarea
