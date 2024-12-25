import React from 'react'

import styles from './Options.module.scss'

const Options = ({ options, selectOption, selected }) => {
  const handleChange = (e) => {
    selectOption(e.target.value)
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
