import c from 'classnames'
import React, { useState, useRef, useEffect } from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './Select.module.scss'

export type SelectOption<T extends string | number = string | number> = {
  value: T
  label: string
}

export type SelectProps<T extends string | number = string | number> = {
  options: SelectOption<T>[]
  selectedLabel: SelectOption<T> | undefined
  onSelect: (value: SelectOption<T>) => void
  size?: 'small' | 'medium'
}

const Select = <T extends string | number = string | number>({
  options,
  selectedLabel,
  onSelect,
  size = 'small',
}: SelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentLabel, setCurrentLabel] = useState<SelectOption<T>>(
    selectedLabel ?? { label: '', value: '' as T },
  )

  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCurrentLabel(selectedLabel ?? { label: '', value: '' as T })
  }, [selectedLabel])

  const handleSelect = (option: SelectOption<T>) => {
    setCurrentLabel(option)
    setIsOpen(false)
    onSelect(option)
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
        {currentLabel?.label ?? ''}
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
