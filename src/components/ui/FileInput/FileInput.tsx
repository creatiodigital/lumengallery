import React, { forwardRef } from 'react'
import type { CSSProperties, FormEventHandler } from 'react'

import styles from './FileInput.module.scss'

type FileInputProps = {
  id: string
  onInput: FormEventHandler<HTMLInputElement>
  style?: CSSProperties
}

const FileInput = forwardRef<HTMLInputElement, FileInputProps>(({ id, onInput }, ref) => {
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

FileInput.displayName = 'FileInput'

export default FileInput
