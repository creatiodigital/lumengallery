'use client'

import { CartLine } from '@/components/cart/CartLine'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import { cartSubtotal, hasLimitedItems } from '@/lib/cart/cartMath'
import { LIMITED_NOT_RESERVED_NOTICE } from '@/lib/cart/notices'
import { useCart } from '@/lib/cart/useCart'
import { formatEuro } from '@/lib/print-providers'

import styles from './CartPage.module.scss'

export const CartPage = () => {
  const { items } = useCart()

  // Nothing in this cart is reserved. A limited edition can sell out while it
  // sits here, so say so once — plainly, with no clock and no countdown.
  const hasLimited = hasLimitedItems(items)

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
          {items.map((item) => (
            <CartLine key={item.lineId} item={item} />
          ))}
          {/* Back to the wizard's first screen for the work they last added —
              the variant picker — because that is where another edition of it
              gets chosen. Deliberately NOT the browser's history and NOT the
              catalogue: the useful destination after looking at your cart is
              the list of editions you were just choosing from. No editLineId
              and no variant param, so it opens clean rather than resuming a
              line that is already in the cart. */}
          <div className={styles.backRow}>
            <Button
              variant="secondary"
              size="regularSquared"
              icon="arrowLeft"
              label="Back to editions"
              href={`/artworks/${items[items.length - 1].artworkSlug}/print`}
            />
          </div>
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
          {/* Same sentence, same place in the panel as the wizard's: the stake
              stated above the button, not discovered after it. */}
          {hasLimited && (
            <Text as="p" size="sm" className={styles.limitedNotice}>
              {LIMITED_NOT_RESERVED_NOTICE}
            </Text>
          )}
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
