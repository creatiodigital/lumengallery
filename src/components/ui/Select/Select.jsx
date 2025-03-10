import c from 'classnames'
import React, { useState, useRef, useEffect } from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './Select.module.scss'

const Select = ({ options, selectedLabel, onSelect, size }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentLabel, setCurrentLabel] = useState(selectedLabel)

  const selectRef = useRef(null)

  useEffect(() => {
    if (selectedLabel) {
      setCurrentLabel(selectedLabel)
    }
  }, [selectedLabel])

  const handleSelect = (option) => {
    setCurrentLabel(option)
    setIsOpen(false)
    if (onSelect) {
      onSelect(option)
    }
  }

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  return (
    <div className={c(styles.select, styles[size])} ref={selectRef}>
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
