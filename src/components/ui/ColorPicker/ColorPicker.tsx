import React, { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'

import styles from './ColorPicker.module.scss'

type ColorPickerProps = {
  textColor: string
  onColorSelect: (color: string) => void
}

const ColorPicker = ({ textColor = '#000000', onColorSelect }: ColorPickerProps) => {
  const [selectedColor, setSelectedColor] = useState(textColor)

  useEffect(() => {
    setSelectedColor(textColor)
  }, [textColor])

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const color = event.target.value
    setSelectedColor(color)
    onColorSelect(color)
  }

  return (
    <div className={styles.picker}>
      <input type="color" value={selectedColor} onChange={handleColorChange} />
      <span className={styles.label}>{selectedColor}</span>
    </div>
  )
}

export default ColorPicker
