import React from 'react'
import c from 'classnames'

import { Icon } from '@/components/ui/Icon'

import styles from './ButtonIcon.module.scss'

function Button({ icon, size = 'small', color = '#ffffff', onClick }) {
  return (
    <button className={c([styles.button, styles[size]])} onClick={onClick}>
      <Icon name={icon} size={size === 'big' ? 24 : 16} color={color} />
    </button>
  )
}

export default Button
