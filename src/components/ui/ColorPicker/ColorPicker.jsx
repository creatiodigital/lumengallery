import React, { useState, useEffect } from 'react'

import styles from './ColorPicker.module.scss'

const ColorPicker = ({ textColor, onColorSelect }) => {
  const [selectedColor, setSelectedColor] = useState(textColor)

  useEffect(() => {
    setSelectedColor(textColor)
  }, [textColor])

  const handleColorChange = (event) => {
    const color = event.target.value
    setSelectedColor(color)

    if (onColorSelect) {
      onColorSelect(color)
    }
  }

  return (
    <div className={styles.picker}>
      <input type="color" value={selectedColor} onChange={handleColorChange} />
      <span className={styles.label}>{selectedColor}</span>
    </div>
  )
}

export default ColorPicker
