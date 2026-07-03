'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { ensureOrderAction } from '@/lib/orders/ensureOrderAction'

import styles from './CartCheckout.module.scss'

type CartConfirmationProps = {
  /** The authorized PaymentIntent id — shown as the order reference. */
  paymentIntentId: string
}

type Status = 'finalizing' | 'confirmed' | 'failed'

/**
 * Cart confirmation step.
 *
 * The "your order is confirmed" message is shown ONLY after the order is
 * verified to exist in our DB — never from the PaymentIntent alone. On arrival
 * this calls ensureOrderAction, which creates the order idempotently if the
 * webhook hasn't yet, so a dead/missing webhook can never leave the buyer with
 * a paid card and no order. If the order genuinely can't be created, we show an
 * honest "we couldn't finalize" state instead of a false confirmation — the
 * card is only authorized (not charged) and the admin is alerted server-side.
 *
 * Covers BOTH entry points (3DS redirect + direct payment success) because both
 * render this component.
 */
export const CartConfirmation = ({ paymentIntentId }: CartConfirmationProps) => {
  const [status, setStatus] = useState<Status>('finalizing')

  useEffect(() => {
    let active = true
    ensureOrderAction(paymentIntentId)
      .then((res) => {
        if (active) setStatus(res.ok ? 'confirmed' : 'failed')
      })
      .catch(() => {
        if (active) setStatus('failed')
      })
    return () => {
      active = false
    }
  }, [paymentIntentId])

  if (status === 'finalizing') {
    return (
      <div className={styles.confirmation}>
        <Text as="h2" font="serif" size="xl" className={styles.confirmHeadline}>
          Finalizing your order…
        </Text>
        <Text as="p" size="md" className={styles.confirmBody}>
          One moment while we confirm your order.
        </Text>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className={styles.confirmation}>
        <Text as="h2" font="serif" size="xl" className={styles.confirmHeadline}>
          Payment received — we&apos;re finalizing your order
        </Text>
        <Text as="p" size="md" className={styles.confirmBody}>
          Your card has been authorized but <strong>not charged</strong>. We hit a snag recording
          your order and have already been notified — we&apos;ll email you to confirm it shortly and
          put right anything that&apos;s wrong. Please don&apos;t pay again.
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
