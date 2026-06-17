'use client'

import React from 'react'
import Link from 'next/link'

import c from 'classnames'

import { Icon, type IconName } from '@/components/ui/Icon'
import type { MouseEventHandler, ReactNode } from 'react'

import styles from './Button.module.scss'

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tab' | 'pill' | 'menuItem' | 'bare'
  size?: 'small' | 'smallSquared' | 'regular' | 'regularSquared' | 'big' | 'bigSquared'
  font?: 'serif' | 'sans' | 'dashboard'
  type?: 'submit' | 'button' | 'reset'
  onClick?: MouseEventHandler<HTMLButtonElement>
  label?: string
  icon?: IconName
  disabled?: boolean
  className?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
  href?: string
  title?: string
  draggable?: boolean
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void
  fullWidth?: boolean
  children?: ReactNode
  form?: string
  style?: React.CSSProperties
  'aria-label'?: string
  'aria-expanded'?: boolean
  'aria-pressed'?: boolean
  'aria-checked'?: boolean
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'dialog' | 'tree' | 'grid'
  'aria-selected'?: boolean
  'aria-invalid'?: boolean
  role?: string
}

export const Button = React.memo(
  ({
    variant = 'primary',
    size = 'regular',
    font = 'sans',
    type = 'button',
    onClick,
    label,
    icon,
    disabled,
    className,
    iconLeft,
    iconRight,
    href,
    title,
    draggable,
    onDragStart,
    fullWidth,
    children,
    form,
    style,
    'aria-label': ariaLabel,
    'aria-expanded': ariaExpanded,
    'aria-pressed': ariaPressed,
    'aria-checked': ariaChecked,
    'aria-haspopup': ariaHaspopup,
    'aria-selected': ariaSelected,
    'aria-invalid': ariaInvalid,
    role,
  }: ButtonProps) => {
    const isIconOnly = icon && !label && !children

    const classNames = c([
      styles.button,
      styles[variant],
      styles[size],
      styles[font],
      isIconOnly && styles.iconOnly,
      disabled && styles.disabled,
      fullWidth && styles.fullWidth,
      className,
    ])

    const iconSize = size === 'big' ? 24 : size === 'small' ? 16 : 20

    const content = children ?? (
      <>
        {iconLeft && <span className={styles.iconLeft}>{iconLeft}</span>}
        {icon && <Icon name={icon} size={iconSize} color="currentColor" />}
        {label}
        {iconRight && <span className={styles.iconRight}>{iconRight}</span>}
      </>
    )

    // Render as Link if href is provided
    if (href) {
      return (
        <Link href={href} className={classNames} title={title} style={style} aria-label={ariaLabel}>
          {content}
        </Link>
      )
    }

    return (
      <button
        className={classNames}
        onClick={onClick}
        type={type}
        disabled={disabled}
        title={title}
        style={style}
        draggable={draggable}
        onDragStart={onDragStart}
        form={form}
        role={role}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-pressed={ariaPressed}
        aria-checked={ariaChecked}
        aria-haspopup={ariaHaspopup}
        aria-selected={ariaSelected}
        aria-invalid={ariaInvalid}
      >
        {content}
      </button>
    )
  },
)

Button.displayName = 'Button'

export default Button
