'use client'

import Link from 'next/link'

import Monogram from '@/icons/monogram.svg'

import { Text } from '@/components/ui/Typography'

import { openCookieSettings } from '@/lib/consent'

import styles from './Footer.module.scss'

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.monogramRow}>
        <Link href="/" className={styles.monogramLink}>
          <Monogram className={styles.monogram} />
        </Link>
      </div>
      <div className={styles.footerInner}>
        <nav className={styles.links}>
          <Link href="/terms-and-conditions">Terms and Conditions</Link>
          <Link href="/terms-of-sale">Online Terms of Sale</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/accessibility-policy">Accessibility Policy</Link>
          <button type="button" onClick={openCookieSettings} className={styles.cookieSettings}>
            Cookie Settings
          </button>
        </nav>
      </div>
      <Text as="p" size="sm" font="serif" className={styles.copyright}>
        &copy; <em>{new Date().getFullYear()} The Art Room</em>
      </Text>
    </footer>
  )
}
