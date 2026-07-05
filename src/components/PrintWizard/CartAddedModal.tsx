'use client'

import { useEffect, useState } from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './PrintWizard.module.scss'

type Props = {
  /** Dismiss the confirmation (unmounts it). */
  onClose: () => void
  /** True when the buyer was editing an existing line — the copy reads
   *  "updated" rather than "added". */
  edited?: boolean
}

/** How long the confirmation stays fully visible before it starts fading. */
const VISIBLE_MS = 2500
/** Fade-out duration — keep in sync with the transition in PrintWizard.module.scss. */
const FADE_MS = 400

/**
 * Brief, self-dismissing confirmation shown after a successful add-to-cart.
 * No actions: it fades out on its own so the buyer can keep configuring the
 * next print (or head to the cart via the header icon). `role="status"`
 * announces it politely without stealing focus from the wizard.
 */
export const CartAddedModal = ({ onClose, edited = false }: Props) => {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), VISIBLE_MS)
    const close = setTimeout(onClose, VISIBLE_MS + FADE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(close)
    }
  }, [onClose])

  return (
    <div
      className={`${styles.cartAddedBanner} ${leaving ? styles.cartAddedLeaving : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.cartAddedCard}>
        <Icon name="check-circle" size={20} />
        <p className={styles.cartAddedTitle}>
          {edited ? 'Your cart has been updated.' : 'Item successfully added to your cart.'}
        </p>
      </div>
    </div>
  )
}
