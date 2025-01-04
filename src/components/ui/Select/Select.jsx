import React, { useState, useRef, useEffect } from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './Select.module.scss'

const Select = ({ options, selectedLabel, onSelect }) => {
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
    <div className={styles.selectMenu} ref={selectRef}>
      <div
        className={`${styles.selectInput} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {currentLabel}
        <Icon name="chevronDown" size={16} color="#333333" />
      </div>

      {isOpen && (
        <ul className={styles.selectDropdown}>
          {options.map((option, i) => (
            <li key={i} className={styles.selectOption} onClick={() => handleSelect(option)}>
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Select
