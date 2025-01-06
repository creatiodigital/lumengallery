import React, { useState, useEffect } from 'react'

import styles from './Checkbox.module.scss'

const Checkbox = ({ checked, onChange, label }) => {
  const [selectedValue, setSelectedValue] = useState(checked)

  useEffect(() => {
    setSelectedValue(checked)
  }, [onChange])

  return (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={selectedValue}
        onChange={onChange}
        className={styles.hiddenCheckbox}
      />
      <span className={styles.customCheckbox}></span>
      {label && <span className={styles.labelText}>{label}</span>}
    </label>
  )
}

export default Checkbox
