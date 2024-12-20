import React from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './ButtonIcon.module.scss'

function Button({ icon, onClick }) {
  return (
    <button className={styles.button} onClick={onClick}>
      <Icon name={icon} size={16} color="#ffffff" />
    </button>
  )
}

export default Button
