import c from 'classnames'
import React, { useState, useRef, useEffect } from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './Select.module.scss'

type SelectOption = {
  value: string | number
  label: string
}

type SelectProps = {
  options: SelectOption[]
  selectedLabel: SelectOption
  onSelect: (value: SelectOption) => void
  size?: 'small' | 'medium'
}

const Select = ({ options, selectedLabel, onSelect, size = 'small' }: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentLabel, setCurrentLabel] = useState<SelectOption>(selectedLabel)

  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCurrentLabel(selectedLabel)
  }, [selectedLabel])

  const handleSelect = (option: SelectOption) => {
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
        {currentLabel.label}
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
