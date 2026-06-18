'use client'

import { useEffect, useRef, useState } from 'react'

import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { Icon } from '@/components/ui/Icon'
import { Text } from '@/components/ui/Typography'

import styles from './HoldCountdown.module.scss'

const HOLD_EXPLAINER =
  'Limited editions are reserved while you decide. This numbered print is held ' +
  'just for you for a few minutes — when the timer runs out it’s released to ' +
  'other collectors and removed from your cart.'

interface HoldCountdownProps {
  /** Server-provided epoch ms the hold expires at. */
  expiresAt: number
  /** Called exactly once when the countdown reaches zero. */
  onExpire?: () => void
}

const remainingMs = (expiresAt: number): number => Math.max(0, expiresAt - Date.now())

const formatMmSs = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Buyer-facing TTL countdown for a limited-edition cart hold. The server owns
 * the clock; this only renders the time left until the server-provided
 * `expiresAt`. At zero it swaps to an expired state and fires `onExpire` once
 * so the line can be cleaned up / re-added. A single interval, cleaned up on
 * unmount.
 */
export const HoldCountdown = ({ expiresAt, onExpire }: HoldCountdownProps) => {
  const [ms, setMs] = useState(() => remainingMs(expiresAt))
  const firedRef = useRef(false)

  useEffect(() => {
    // A new expiresAt (hold extended / re-reserved) re-arms the countdown.
    firedRef.current = false
    setMs(remainingMs(expiresAt))

    const id = window.setInterval(() => {
      const left = remainingMs(expiresAt)
      setMs(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        onExpire?.()
      }
    }, 1000)

    return () => window.clearInterval(id)
  }, [expiresAt, onExpire])

  if (ms <= 0) {
    return (
      <Text as="span" size="xs" className={styles.expired} aria-live="polite">
        Hold expired — please re-add
      </Text>
    )
  }

  return (
    <span className={styles.countdown}>
      <Text as="span" size="xs" aria-live="polite">
        Held for you — {formatMmSs(ms)}
      </Text>
      <HelpTooltip content={HOLD_EXPLAINER} placement="top">
        <Icon name="info" size={14} />
      </HelpTooltip>
    </span>
  )
}
