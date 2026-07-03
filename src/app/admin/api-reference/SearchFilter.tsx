'use client'

import { useState, useCallback } from 'react'

interface SearchFilterProps {
  onFilterChange: (query: string) => void
}

export default function SearchFilter({ onFilterChange }: SearchFilterProps) {
  const [value, setValue] = useState('')

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value
      setValue(query)
      onFilterChange(query)
    },
    [onFilterChange],
  )

  return (
    // Native input intentionally — the api-reference admin tool has its
    // own dark theme that's distinct from the design system, so we don't
    // route it through the shared Input component.
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder="Search routes, models, fields..."
      style={{
        width: '100%',
        maxWidth: 420,
        padding: '0.55rem 0.85rem',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        color: 'var(--ref-text)', // scoped on the page's .container
        fontSize: '0.82rem',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.15s',
        marginBottom: '1.5rem',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.4)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
      }}
    />
  )
}
