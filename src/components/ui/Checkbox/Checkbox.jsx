import React from 'react'

import styles from './Checkbox.module.scss'

const Checkbox = ({ checked = false, onChange, label }) => {
  return (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={styles.hiddenCheckbox}
      />
      <span className={styles.customCheckbox}></span>
      {label && <span className={styles.labelText}>{label}</span>}
    </label>
  )
}

export default Checkbox
