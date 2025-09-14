import c from 'classnames'
import React, { useState, useRef, useEffect } from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './Select.module.scss'

export type SelectOption<T> = {
  value: T
  label: string
}

export type SelectProps<T extends string | number = string | number> = {
  options: SelectOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  size?: 'small' | 'medium'
}

const Select = <T extends string | number = string | number>({
  options,
  value,
  onChange,
  size = 'small',
}: SelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  const currentOption =
    options.find((opt) => opt.value === value) ?? ({ label: '', value: '' as T } as SelectOption<T>)

  const handleSelect = (option: SelectOption<T>) => {
    setIsOpen(false)
    onChange(option.value)
  }

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div className={c(styles.select, size && styles[size])} ref={selectRef}>
      <div className={styles.input} onClick={() => setIsOpen(!isOpen)}>
        {currentOption?.label ?? ''}
        <Icon name="chevronDown" size={size === 'medium' ? 20 : 16} color="#333333" />
      </div>

      {isOpen && (
        <ul className={styles.dropdown}>
          {options.map((option) => (
            <li key={option.value} className={styles.option} onClick={() => handleSelect(option)}>
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Select
