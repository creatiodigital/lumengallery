'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { SpecsSummary } from '@/lib/print-providers'

import styles from './SpecList.module.scss'

/**
 * Shared "what you selected" list. Renders one row per dimension the
 * buyer has configured, using each dimension's own buyer-facing label
 * + value as supplied by `summarizeConfig`.
 *
 * Provider-agnostic by construction: the rows are whatever the catalog
 * declared, in declaration order. A new dimension added to a provider's
 * catalog (e.g. when a glass option is added) shows up here automatically —
 * no edit to this file required.
 *
 * Collapsible: when enough rows sit past `visibleByDefault`, the rest hide
 * behind a "Show all selected options" toggle so the summary panel doesn't
 * push the CTA off-screen on shorter viewports. Framed configs commonly
 * produce 9–10 rows, which is what the toggle is for.
 */
/** Fewest rows worth hiding behind the toggle. */
const MIN_HIDDEN_ROWS = 2

interface SpecListProps {
  specs: SpecsSummary
  className?: string
  visibleByDefault?: number
}

export const SpecList = ({ specs, className, visibleByDefault = 5 }: SpecListProps) => {
  const [expanded, setExpanded] = useState(false)
  if (specs.length === 0) return null

  // Collapsing has to earn its place: the toggle is itself a row of chrome, so
  // hiding a single spec saves nothing and just adds a control. A limited
  // edition produces exactly five rows against the cart's four-row budget,
  // which put a "Show all selected options" button there to hide one line.
  const collapsible = specs.length - visibleByDefault >= MIN_HIDDEN_ROWS
  const visible = expanded || !collapsible ? specs : specs.slice(0, visibleByDefault)

  return (
    <div className={`${styles.wrapper}${className ? ` ${className}` : ''}`}>
      <dl className={styles.specList}>
        {visible.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {collapsible && (
        <Button
          variant="ghost"
          className={styles.toggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span>{expanded ? 'Show less' : 'Show all selected options'}</span>
          <span className={`${styles.chevron}${expanded ? ` ${styles.chevronOpen}` : ''}`}>
            <Icon name="chevronDown" size={14} />
          </span>
        </Button>
      )}
    </div>
  )
}
