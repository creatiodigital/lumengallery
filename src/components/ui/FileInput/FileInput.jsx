import React from 'react'

import styles from './FileInput.module.scss'

function FileInput({ id, onInput }) {
  return <input id={id} className={styles.input} type="file" accept="image/*" onInput={onInput} />
}

export default FileInput
