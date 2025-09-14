import c from 'classnames'
import React from 'react'

import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/components/ui/Icon'

import styles from './ButtonIcon.module.scss'

type ButtonIconProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'color'> & {
  icon: IconName
  size?: 'small' | 'big'
  color?: string
}

export const ButtonIcon = ({
  icon,
  size = 'small',
  color = '#ffffff',
  type = 'button',
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
}: ButtonIconProps) => {
  return (
    <button
      className={c([styles.button, styles[size]])}
      type={type}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Icon name={icon} size={size === 'big' ? 24 : 16} color={color} />
    </button>
  )
}

export default ButtonIcon
