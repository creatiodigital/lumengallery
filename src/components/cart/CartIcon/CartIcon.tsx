'use client'

import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'

import { useCart } from '@/lib/cart/useCart'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './CartIcon.module.scss'

export const CartIcon = () => {
  const { count } = useCart()

  return (
    <Link href="/cart" className={styles.cartLink} aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
      <ShoppingBag size={24} strokeWidth={ICON_STROKE_WIDTH} />
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  )
}
