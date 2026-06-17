'use client'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

import styles from './CartCheckout.module.scss'

type CartConfirmationProps = {
  /** The authorized PaymentIntent id — shown as the order reference. */
  paymentIntentId: string
}

/**
 * Minimal cart confirmation step. Built cart-specific rather than reusing the
 * single-print PrintConfirmation, which is a full-page route view keyed to one
 * artwork (slug/title/image/artist) and clears the print sessionStorage stash.
 * The cart has many lines and no single artwork, so a slim in-component
 * success panel is the right shape; it lives inside CartCheckout's PageLayout.
 *
 * Mirrors PrintConfirmation's success copy: with manual capture the card is
 * authorized (held), not yet charged — we capture when the order enters
 * production and email the buyer then.
 */
export const CartConfirmation = ({ paymentIntentId }: CartConfirmationProps) => {
  return (
    <div className={styles.confirmation}>
      <Text as="h2" font="serif" size="xl" className={styles.confirmHeadline}>
        Thank you — your order is confirmed.
      </Text>
      <Text as="p" size="md" className={styles.confirmBody}>
        We&apos;ve placed a hold on your card and your order is now being prepared. We&apos;ll
        charge your card once your prints enter production, and send a confirmation email with
        tracking details as soon as they ship.
      </Text>

      <div className={styles.confirmReference}>
        <Text as="span" size="xs" className={styles.confirmReferenceLabel}>
          Reference
        </Text>
        <Text as="span" size="sm" className={styles.confirmReferenceValue}>
          {paymentIntentId}
        </Text>
      </div>

      <Button variant="primary" size="bigSquared" href="/prints" label="Browse more prints" />
    </div>
  )
}
