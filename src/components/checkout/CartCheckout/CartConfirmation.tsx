'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { ensureOrderAction } from '@/lib/orders/ensureOrderAction'
import {
  EDITION_NUMBER_NOTICE_BODY,
  EDITION_NUMBER_NOTICE_HEADING,
} from '@/lib/editions/editionNumberNotice'

import { UnboxingReminderModal } from './UnboxingReminderModal'
import styles from './CartCheckout.module.scss'

type CartConfirmationProps = {
  /** The authorized PaymentIntent id — shown as the order reference. */
  paymentIntentId: string
}

type Status = 'finalizing' | 'confirmed' | 'failed'

/** Per-order key, so the reminder shows once and a reload doesn't nag. */
const REMINDER_DISMISSED_KEY = 'the-art-room:unboxing-reminder:'

/** sessionStorage throws in Safari private mode — a reminder is never worth
 *  breaking the confirmation screen over, so both accessors swallow. */
function reminderAlreadySeen(paymentIntentId: string): boolean {
  try {
    return sessionStorage.getItem(`${REMINDER_DISMISSED_KEY}${paymentIntentId}`) !== null
  } catch {
    return false
  }
}

function markReminderSeen(paymentIntentId: string): void {
  try {
    sessionStorage.setItem(`${REMINDER_DISMISSED_KEY}${paymentIntentId}`, '1')
  } catch {
    /* no-op */
  }
}

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
  const [orderRef, setOrderRef] = useState<string | null>(null)
  const [hasLimitedEdition, setHasLimitedEdition] = useState(false)
  const [showReminder, setShowReminder] = useState(false)

  useEffect(() => {
    let active = true
    ensureOrderAction(paymentIntentId)
      .then((res) => {
        if (!active) return
        setStatus(res.ok ? 'confirmed' : 'failed')
        if (res.orderRef) setOrderRef(res.orderRef)
        setHasLimitedEdition(res.hasLimitedEdition === true)
      })
      .catch(() => {
        if (active) setStatus('failed')
      })
    return () => {
      active = false
    }
  }, [paymentIntentId])

  // Ask for unboxing images once the order is actually confirmed — never on
  // the failed path, where the buyer has a real problem to worry about first.
  useEffect(() => {
    if (status !== 'confirmed') return
    if (reminderAlreadySeen(paymentIntentId)) return
    setShowReminder(true)
  }, [status, paymentIntentId])

  const dismissReminder = () => {
    setShowReminder(false)
    markReminderSeen(paymentIntentId)
  }

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
      {/* Says "payment", never "card". Manual capture is offered on every
          method Stripe gives us — a PayPal buyer was being told about a card
          they never used. Method-agnostic wording stays true for whatever the
          Payment Element offers next, without plumbing the method through. */}
      <Text as="p" size="md" className={styles.confirmBody}>
        Your payment is authorized and your order is now being prepared. We&apos;ll take the payment
        once your prints enter production, and send a confirmation email with tracking details as
        soon as they ship.
      </Text>

      {/* Limited lines only: an open-edition buyer has no number coming and
          should not be told to wait for one. The number IS already assigned,
          but naming it here would promise a copy a cancellation could take
          back — see editionNumberNotice for the full reasoning. */}
      {hasLimitedEdition && (
        <div className={styles.editionNotice}>
          <Text as="span" size="xs" className={styles.editionNoticeHeading}>
            {EDITION_NUMBER_NOTICE_HEADING}
          </Text>
          <Text as="p" size="sm" className={styles.editionNoticeBody}>
            {EDITION_NUMBER_NOTICE_BODY}
          </Text>
        </div>
      )}

      {/* The buyer's ONE reference — identical to the string on every email and
          the invoice, so quoting it back to us always finds this order. The
          PaymentIntent id stays out of the customer's way; it appears only on
          the failed path below, where it is the only identifier that exists. */}
      <div className={styles.confirmReference}>
        <Text as="span" size="xs" className={styles.confirmReferenceLabel}>
          Order reference
        </Text>
        <Text as="span" size="sm" className={styles.confirmReferenceValue}>
          {orderRef ?? paymentIntentId}
        </Text>
      </div>

      <Button variant="primary" size="bigSquared" href="/prints" label="Browse more prints" />

      {showReminder && <UnboxingReminderModal onClose={dismissReminder} />}
    </div>
  )
}
