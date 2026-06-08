'use client'

import styles from './RadioGroup.module.scss'

export type RadioOption<V extends string = string> = {
  value: V
  label: string
  /** Optional helper text shown under the label. */
  description?: string
  disabled?: boolean
}

type RadioGroupProps<V extends string = string> = {
  /** Shared input name — groups the radios so only one is selectable. */
  name: string
  options: RadioOption<V>[]
  value: V
  onChange: (value: V) => void
  /** Disable the whole group. */
  disabled?: boolean
  /** Layout direction. Default 'row'. */
  direction?: 'row' | 'column'
}

/**
 * Accessible radio-button group — the reusable single-choice control for
 * mutually-exclusive options (e.g. the artwork's series type). Supports
 * per-option and whole-group disabling.
 */
export function RadioGroup<V extends string = string>({
  name,
  options,
  value,
  onChange,
  disabled = false,
  direction = 'row',
}: RadioGroupProps<V>) {
  return (
    <div className={styles.group} data-direction={direction}>
      {options.map((opt) => {
        const isDisabled = disabled || opt.disabled === true
        return (
          <label
            key={opt.value}
            className={`${styles.option} ${isDisabled ? styles.disabled : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={isDisabled}
              onChange={() => onChange(opt.value)}
              className={styles.input}
            />
            <span className={styles.body}>
              <span className={styles.label}>{opt.label}</span>
              {opt.description && <span className={styles.description}>{opt.description}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}
