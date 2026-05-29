'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

import { getConsent, setConsent, OPEN_COOKIE_SETTINGS_EVENT } from '@/lib/consent'

import styles from './CookieBanner.module.scss'

export const CookieBanner = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show on first visit (no decision stored yet).
    if (getConsent() === null) setVisible(true)

    // Allow the footer "Cookie settings" link to re-open the banner.
    const handleOpen = () => setVisible(true)
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpen)
  }, [])

  const decide = (analytics: boolean) => {
    setConsent(analytics)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={styles.banner} role="region" aria-label="Cookie consent">
      <Text as="p" size="sm" className={styles.text}>
        <strong className={styles.brand}>The Art Room</strong> uses analytics cookies to understand
        how the gallery is explored and improve your experience. Declining won&apos;t affect your
        visit.{' '}
        {/* Opens in a new tab so the policy is readable without dismissing this notice. */}
        <Link
          href="/privacy-policy"
          className={styles.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </Link>
      </Text>
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="regularSquared"
          fullWidth
          onClick={() => decide(true)}
          aria-label="Accept analytics cookies"
        >
          Accept
        </Button>
        <Button
          variant="secondary"
          size="regularSquared"
          fullWidth
          onClick={() => decide(false)}
          aria-label="Decline analytics cookies"
        >
          Decline
        </Button>
      </div>
    </div>
  )
}
