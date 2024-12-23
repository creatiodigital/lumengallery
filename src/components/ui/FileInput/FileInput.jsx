import React, { forwardRef } from 'react'
import styles from './FileInput.module.scss'

const FileInput = forwardRef(({ id, onInput }, ref) => {
  return (
    <input
      ref={ref}
      id={id}
      className={styles.input}
      type="file"
      accept="image/*"
      onInput={onInput}
    />
  )
})

export default FileInput
