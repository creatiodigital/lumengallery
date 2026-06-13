'use client'

import Link from 'next/link'
import c from 'classnames'

import { CartIcon } from '@/components/cart/CartIcon'
import { Navigation } from '@/components/ui/Navigation'
import Logo from '@/icons/logo.svg'

import styles from './Header.module.scss'

type HeaderProps = {
  /** Remove the bottom border (e.g. on the home page where the slideshow sits below) */
  borderless?: boolean
}

export const Header = ({ borderless = false }: HeaderProps) => {
  return (
    <header className={c(styles.header, borderless && styles.borderless)}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
        <Navigation />
        <CartIcon />
      </div>
    </header>
  )
}
