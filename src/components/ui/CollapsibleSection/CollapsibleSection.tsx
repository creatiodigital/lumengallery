'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './CollapsibleSection.module.scss'

const STORAGE_PREFIX = 'collapsible-'

/** Reading localStorage throws in some privacy modes, and is unavailable during
 *  SSR — either way the section should still render, just unremembered. */
const readStored = (key: string | undefined, fallback: boolean): boolean => {
  if (!key || typeof window === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    return stored === null ? fallback : stored === '1'
  } catch {
    return fallback
  }
}

const writeStored = (key: string | undefined, open: boolean): void => {
  if (!key || typeof window === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, open ? '1' : '0')
  } catch {
    /* storage unavailable — the section simply will not be remembered */
  }
}

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  /** If provided, the component is controlled by the parent. */
  open?: boolean
  onToggle?: (open: boolean) => void
  /** Used only when the component is uncontrolled. */
  defaultOpen?: boolean
  /** Remember open/closed across reloads under this key. Uncontrolled only.
   *  An explicit key rather than one derived from `title`, so two sections that
   *  happen to share a label do not share a state. */
  persistKey?: string
  className?: string
}

/**
 * Generic accordion section: header bar + collapsible body.
 * Distinct from any accordion used for exhibition wall panels.
 * Can be controlled (pass `open` + `onToggle`) or self-managed (`defaultOpen`).
 */
export const CollapsibleSection = ({
  title,
  children,
  open,
  onToggle,
  defaultOpen = false,
  persistKey,
  className,
}: CollapsibleSectionProps) => {
  const isControlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState(() => readStored(persistKey, defaultOpen))
  const isOpen = isControlled ? open : internalOpen

  const handleToggle = () => {
    const next = !isOpen
    if (!isControlled) {
      setInternalOpen(next)
      writeStored(persistKey, next)
    }
    onToggle?.(next)
  }

  return (
    <section className={`${styles.section} ${isOpen ? styles.sectionOpen : ''} ${className ?? ''}`}>
      <Button
        variant="bare"
        onClick={handleToggle}
        className={styles.header}
        aria-expanded={isOpen}
      >
        <span className={styles.title}>{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={ICON_STROKE_WIDTH}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          aria-hidden
        />
      </Button>
      {isOpen && <div className={styles.body}>{children}</div>}
    </section>
  )
}
