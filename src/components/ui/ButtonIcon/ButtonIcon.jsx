import c from 'classnames'
import React from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './ButtonIcon.module.scss'

function Button({
  icon,
  size = 'small',
  color = '#ffffff',
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
}) {
  return (
    <button
      className={c([styles.button, styles[size]])}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Icon name={icon} size={size === 'big' ? 24 : 16} color={color} />
    </button>
  )
}

export default Button
