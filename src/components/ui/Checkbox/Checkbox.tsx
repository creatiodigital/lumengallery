import type { ChangeEventHandler } from 'react'

import styles from './Checkbox.module.scss'

type CheckboxProps = {
  checked: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
  label: string
}

const Checkbox = ({ checked = false, onChange, label }: CheckboxProps) => {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={onChange} className={styles.hidden} />
      <span className={styles.span}></span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  )
}

export default Checkbox
