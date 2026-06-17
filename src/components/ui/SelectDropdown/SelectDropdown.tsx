'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './SelectDropdown.module.scss'

export type SelectOption<V extends string = string> = {
  value: V
  label: string
  description?: string
  /** If set, the option is shown but not selectable (greyed + tooltip). */
  disabled?: boolean
  /** Optional tooltip text shown when hovering a disabled option. */
  disabledReason?: string
  /** Rich tooltip shown when hovering this option in the open menu.
   *  Replaces the "i" affordance next to the label for dimensions
   *  where explanations are per-option (e.g. paper tiers). */
  tooltip?: ReactNode
  /** Optional illustration shown to the left of the tooltip content. */
  tooltipImage?: ReactNode
  /** End-of-row indicator (e.g. a check-circle marking the artist's
   *  recommended paper). Rendered both in the open menu and on the
   *  closed control when this option is the selected value. */
  badge?: ReactNode
}

interface SelectDropdownProps<V extends string = string> {
  /** Optional label shown above the control. */
  label?: string
  options: SelectOption<V>[]
  value: V
  onChange: (value: V) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Visual style of the closed control. 'boxed' (default) = bordered input;
   *  'plain' = borderless text + chevron (underlines on hover). */
  variant?: 'boxed' | 'plain'
  /** Mark the control invalid: red border + `aria-invalid`. */
  invalid?: boolean
}

/**
 * Custom dropdown: click-to-open, click-outside-to-close.
 * Styled to match the site's neutral palette. Supports an optional
 * description per option.
 */
export const SelectDropdown = <V extends string = string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  variant = 'boxed',
  invalid,
}: SelectDropdownProps<V>) => {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Map<string, HTMLLIElement>>(new Map())

  // Typeahead buffer: characters typed in quick succession compose a prefix
  // we match against option labels. Cleared after a short idle window so
  // users can start fresh ("Sp" → Spain, then wait, then "F" → France).
  const typedRef = useRef('')
  const typedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const TYPEAHEAD_RESET_MS = 700

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (typedTimerRef.current) clearTimeout(typedTimerRef.current)
    }
  }, [])

  const selected = options.find((o) => o.value === value)

  // Finds the first selectable option whose label starts with the typeahead
  // buffer. If nothing starts with it, falls back to a substring match so
  // mistyped or mid-word searches still land somewhere useful.
  const findMatch = (buffer: string): SelectOption<V> | undefined => {
    const q = buffer.toLowerCase()
    const selectable = options.filter((o) => !o.disabled)
    return (
      selectable.find((o) => o.label.toLowerCase().startsWith(q)) ??
      selectable.find((o) => o.label.toLowerCase().includes(q))
    )
  }

  const handleTypeahead = (char: string) => {
    if (typedTimerRef.current) clearTimeout(typedTimerRef.current)
    typedRef.current += char.toLowerCase()
    typedTimerRef.current = setTimeout(() => {
      typedRef.current = ''
    }, TYPEAHEAD_RESET_MS)

    const match = findMatch(typedRef.current)
    if (!match) return
    onChange(match.value)
    // If the menu is open, scroll the match into view so the user sees it.
    const li = optionRefs.current.get(match.value)
    li?.scrollIntoView({ block: 'nearest' })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    // Single printable character → typeahead (letters, numbers, space).
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      handleTypeahead(e.key)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault()
        setOpen(true)
      }
    }
  }

  return (
    <div
      className={`${styles.wrapper} ${variant === 'plain' ? styles.wrapperPlain : ''} ${className ?? ''}`}
      ref={wrapperRef}
      onKeyDown={handleKeyDown}
    >
      {label && <span className={styles.label}>{label}</span>}
      <Button
        variant="bare"
        className={`${styles.control} ${variant === 'plain' ? styles.controlPlain : ''} ${open ? styles.controlOpen : ''} ${invalid ? styles.invalid : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
      >
        <span className={styles.controlLabel}>
          {selected ? selected.label : (placeholder ?? 'Select…')}
        </span>
        {selected?.badge && <span className={styles.controlBadge}>{selected.badge}</span>}
        <ChevronDown
          size={16}
          strokeWidth={ICON_STROKE_WIDTH}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden
        />
      </Button>

      {open && (
        <ul className={styles.menu} role="listbox">
          {options.map((opt) => {
            const isSelected = opt.value === value
            const isDisabled = !!opt.disabled
            const button = (
              <Button
                variant="bare"
                className={`${styles.option} ${isSelected ? styles.optionSelected : ''} ${isDisabled ? styles.optionDisabled : ''}`}
                disabled={isDisabled}
                title={isDisabled ? opt.disabledReason : undefined}
                onClick={() => {
                  if (isDisabled) return
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                <span className={styles.optionLabel}>{opt.label}</span>
                {opt.description && (
                  <span className={styles.optionDescription}>{opt.description}</span>
                )}
                {isDisabled && opt.disabledReason && (
                  <span className={styles.optionDisabledNote}>{opt.disabledReason}</span>
                )}
                {opt.badge && <span className={styles.optionBadge}>{opt.badge}</span>}
              </Button>
            )
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                ref={(el) => {
                  if (el) optionRefs.current.set(opt.value, el)
                  else optionRefs.current.delete(opt.value)
                }}
              >
                {opt.tooltip && !isDisabled ? (
                  <HelpTooltip
                    content={opt.tooltip}
                    image={opt.tooltipImage}
                    placement="right"
                    offset={24}
                    className={styles.tooltipWrapper}
                  >
                    {button}
                  </HelpTooltip>
                ) : (
                  button
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
