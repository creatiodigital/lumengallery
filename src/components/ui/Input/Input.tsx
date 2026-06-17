'use client'

import c from 'classnames'
import { useState } from 'react'
import type { ChangeEventHandler, FocusEventHandler, KeyboardEventHandler } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/components/ui/Icon'

import styles from './Input.module.scss'

type TInput = {
  variant?: string
  size?: 'regular' | 'medium' | 'bare'
  /**
   * NOTE: we deliberately do not allow `type="number"`. Native
   * number inputs auto-format per browser locale (showing "30,5"
   * instead of "30.5" in Spanish/French/German), which we don't
   * want — see the consistent decimal convention used throughout
   * the app: period for display, accept both period and comma on
   * input. Use `type="text"` with `inputMode="decimal"` for any
   * numeric/decimal field.
   */
  type?: 'text' | 'password' | 'email' | 'tel' | 'search' | 'url'
  /** Hint to mobile keyboards. Use `'decimal'` for any decimal field. */
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'email' | 'url' | 'search' | 'none'
  /** Controlled value. Pair with `onChange`. Omit to render uncontrolled
   *  (use `defaultValue` instead) — required for forms that rely on
   *  Chrome autofill, since React rerenders fight the autofill engine. */
  value?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
  /** Uncontrolled initial value. Use this with `name` for forms read via
   *  `FormData`, e.g. the print checkout shipping address form. */
  defaultValue?: string
  /** Form field name — required when uncontrolled (so FormData picks it
   *  up). Optional but useful when controlled, for accessibility. */
  name?: string
  icon?: IconName
  rotate?: number
  onBlur?: FocusEventHandler<HTMLInputElement>
  onFocus?: FocusEventHandler<HTMLInputElement>
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  autoFocus?: boolean
  autoComplete?: string
  placeholder?: string
  required?: boolean
  /** Mark the field invalid: red border (non-bare sizes) + `aria-invalid`.
   *  Bare inputs get the border from the FormField wrapper's `data-error`,
   *  but still report `aria-invalid` here. */
  invalid?: boolean
  /** Hard cap on number of characters the user can type. Match the
   *  server-side cap so the client can't smuggle oversized payloads
   *  past the same-key validation. */
  maxLength?: number
  id?: string
  className?: string
  /** Class applied directly to the underlying `<input>` element. Use this
   *  when a parent stylesheet styles inputs by class (e.g. the wizard's
   *  `.fieldInput`) and the wrapper-level `className` would land in the
   *  wrong place. */
  inputClassName?: string
  showPasswordToggle?: boolean
  tabIndex?: number
  disabled?: boolean
  readOnly?: boolean
  'aria-label'?: string
}

const Input = ({
  variant,
  size = 'regular',
  type = 'text',
  inputMode,
  value,
  onChange,
  defaultValue,
  name,
  icon,
  rotate,
  onBlur,
  onFocus,
  onKeyDown,
  autoFocus = false,
  autoComplete,
  placeholder,
  required,
  invalid,
  maxLength,
  id,
  className,
  inputClassName,
  showPasswordToggle = false,
  tabIndex,
  disabled,
  readOnly,
  'aria-label': ariaLabel,
}: TInput) => {
  const [showPassword, setShowPassword] = useState(false)

  // Determine actual input type based on password visibility
  const inputType = type === 'password' && showPassword ? 'text' : type

  return (
    <div className={c(styles.wrapper, className)}>
      <input
        id={id}
        name={name}
        type={inputType}
        inputMode={inputMode}
        // size="bare" skips ALL Input styles so the consumer's
        // `inputClassName` owns the visual completely. Used by forms with
        // their own input class (e.g. wizard / checkout `.fieldInput`).
        className={c(
          size === 'bare'
            ? null
            : [
                styles.input,
                styles[size],
                variant && styles[variant],
                { [styles.withIcon]: !!icon },
                { [styles.withToggle]: type === 'password' && showPasswordToggle },
                { [styles.disabled]: disabled },
                { [styles.invalid]: invalid },
              ],
          inputClassName,
        )}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        tabIndex={tabIndex}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
      />
      {icon && (
        <div className={c(styles.icon, { [styles[`rotate${rotate}` as string]]: !!rotate })}>
          <Icon name={icon} size={16} color="#444444" />
        </div>
      )}
      {type === 'password' && showPasswordToggle && (
        <Button
          variant="ghost"
          onClick={() => setShowPassword(!showPassword)}
          className={styles.passwordToggle}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} color="#666666" />
        </Button>
      )}
    </div>
  )
}

export default Input
