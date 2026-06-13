'use client'

import { useEffect, useRef } from 'react'

import { CartLine } from '@/components/cart/CartLine'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import { cartSubtotal } from '@/lib/cart/cartMath'
import { useCart } from '@/lib/cart/useCart'
import { formatEuro } from '@/lib/print-providers'

import styles from './CartPage.module.scss'

// Refresh limited-edition holds while the buyer sits on the cart page so an
// engaged viewer's reservation doesn't lapse under them. Well under the 15-min
// server TTL; the server still owns the clock and re-syncs each expiry.
const HOLD_HEARTBEAT_MS = 5 * 60 * 1000

export const CartPage = () => {
  const { items, extendHolds } = useCart()

  const hasLimitedHolds = items.some(
    (item) => item.editionType === 'limited' && !!item.editionNumberIds?.length,
  )

  // Keep the latest extendHolds in a ref so the heartbeat interval is stable
  // across cart edits — a quantity/remove change shouldn't reset the timer.
  const extendHoldsRef = useRef(extendHolds)
  useEffect(() => {
    extendHoldsRef.current = extendHolds
  }, [extendHolds])

  useEffect(() => {
    if (!hasLimitedHolds) return
    const id = window.setInterval(() => {
      void extendHoldsRef.current()
    }, HOLD_HEARTBEAT_MS)
    return () => window.clearInterval(id)
  }, [hasLimitedHolds])

  if (items.length === 0) {
    return (
      <PageLayout>
        <PageHeader pageTitle="Cart" />
        <div className={styles.empty}>
          <Text as="p" font="serif" size="lg" className={styles.emptyText}>
            Your cart is empty
          </Text>
          <Button variant="primary" size="bigSquared" href="/prints" label="Browse prints" />
        </div>
      </PageLayout>
    )
  }

  // Item prices only — shipping and VAT are added later at checkout.
  const subtotalCents = cartSubtotal(items)

  return (
    <PageLayout>
      <PageHeader pageTitle="Cart" />

      <div className={styles.cartGrid}>
        <div className={styles.items}>
          <div className={styles.tableHeader}>
            <span>Item</span>
            <span>Price</span>
            <span>Quantity</span>
            <span>Total</span>
          </div>
          {items.map((item) => (
            <CartLine key={item.lineId} item={item} />
          ))}
        </div>

        <aside className={styles.summary}>
          <Text as="h2" font="serif" size="xl" className={styles.summaryTitle}>
            Order summary
          </Text>
          <div className={styles.subtotalRow}>
            <Text as="span" size="md" className={styles.subtotalLabel}>
              Subtotal
            </Text>
            <Text as="span" font="serif" size="lg" className={styles.subtotalValue}>
              {formatEuro(subtotalCents)}
            </Text>
          </div>
          <Text as="p" size="sm" className={styles.note}>
            Shipping and taxes calculated at checkout.
          </Text>
          <Button
            variant="primary"
            size="bigSquared"
            fullWidth
            href="/checkout"
            label="Continue to checkout"
            className={styles.cta}
          />
          <Button
            variant="secondary"
            size="bigSquared"
            fullWidth
            href="/prints"
            label="Continue shopping"
            className={styles.secondaryCta}
          />
        </aside>
      </div>
    </PageLayout>
  )
}
