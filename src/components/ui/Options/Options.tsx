import React from 'react'

import styles from './Options.module.scss'

type Option = {
  value: string | number
  label: string
}

type OptionsProps = {
  options: Option[]
  selectOption: (value: string | number) => void
  selected: string | number
}

const Options = ({ options, selectOption, selected }: OptionsProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    // radio inputs always give string, so coerce if needed
    const parsedValue = isNaN(Number(value)) ? value : Number(value)
    selectOption(parsedValue)
  }

  return (
    <div className={styles.options}>
      {options.map((option) => (
        <label
          key={option.value}
          style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}
        >
          <input
            type="radio"
            value={option.value}
            checked={selected === option.value}
            onChange={handleChange}
            style={{ marginRight: '10px' }}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export default Options
