import React from 'react'

import styles from './Checkbox.module.scss'

const Checkbox = ({ checked = false, onChange, label }) => {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={onChange} className={styles.hidden} />
      <span className={styles.span}></span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  )
}

export default Checkbox
