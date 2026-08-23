'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import Logo from '@/icons/logo.svg'

import { clearPrintSession } from '../clearPrintSession'

import styles from './PrintConfirmation.module.scss'

interface PrintConfirmationProps {
  artwork: {
    slug: string
    title: string
    imageUrl: string
    artistName: string
  }
  paymentIntentId: string | null
  status: 'succeeded' | 'processing' | 'failed' | 'unknown' | 'order_failed'
}

/**
 * Stub confirmation screen. Phase 2.4 will:
 *   - Look up the real Order row by payment_intent_id
 *   - Show the fulfillment status (submitted / in production / shipped)
 *   - Trigger the confirmation email (Resend) from the webhook, not here
 *
 * Status is verified server-side against Stripe — never trust the
 * `redirect_status` querystring alone.
 */
export const PrintConfirmation = ({ artwork, paymentIntentId, status }: PrintConfirmationProps) => {
  useEffect(() => {
    // Also clear on order_failed: the card is authorized, so re-mounting the
    // wizard with the old stash could let the buyer pay again — don't.
    if (status !== 'succeeded' && status !== 'processing' && status !== 'order_failed') return
    // Wipe every stash for this artwork so a return visit starts the
    // wizard fresh — the previous order's config / country / address /
    // payment ids would otherwise re-hydrate on the next /print mount.
    clearPrintSession(artwork.slug)
  }, [artwork.slug, status])

  let headline =
    status === 'succeeded'
      ? 'Thank you — your order is confirmed.'
      : status === 'processing'
        ? 'Payment is processing.'
        : status === 'unknown'
          ? 'We couldn\u2019t find your payment.'
          : 'Payment didn\u2019t complete.'

  let body =
    status === 'succeeded'
      ? // "payment", never "card" — manual capture works on every method the
        // Payment Element offers, and a PayPal buyer has no card to hold.
        `Your payment is authorized and your order is now being prepared. We\u2019ll take the payment once your print enters production, and send a confirmation email with tracking details as soon as it ships.`
      : status === 'processing'
        ? `We\u2019ll email you as soon as the payment is fully cleared. You don\u2019t need to do anything else.`
        : status === 'unknown'
          ? `If you just completed a payment, please check your email for a receipt. Otherwise start a new order from the artwork page.`
          : `You have not been charged. You can try again from the checkout screen.`

  // order_failed: the card is authorized but we couldn't record the order.
  // Honest + distinct from a declined card — the card was NOT charged.
  if (status === 'order_failed') {
    headline = 'Payment received — we’re finalizing your order'
    body = `Your payment has been authorized but not taken. We hit a snag recording your order and have already been notified — we’ll email you to confirm it shortly and put right anything that’s wrong. Please don’t pay again.`
  }

  return (
    <div className={styles.confirmation}>
      <header className={styles.header}>
        <Link href="/" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
      </header>

      <main className={styles.body}>
        <section className={styles.card}>
          {artwork.imageUrl && (
            <Image
              src={artwork.imageUrl}
              alt={artwork.title}
              width={120}
              height={120}
              // Skip the Vercel optimizer (already-optimized R2/CDN .webp); cold
              // re-encodes broke images on first load (AR-125).
              unoptimized
              className={styles.thumb}
            />
          )}
          <h1 className={styles.headline}>{headline}</h1>
          <p className={styles.bodyText}>{body}</p>

          <div className={styles.orderMeta}>
            <div>
              <span>Title</span>
              <strong>{artwork.title}</strong>
            </div>
            <div>
              <span>Author</span>
              <strong>{artwork.artistName}</strong>
            </div>
            {paymentIntentId && (
              <div>
                <span>Reference</span>
                <strong>{paymentIntentId}</strong>
              </div>
            )}
          </div>

          <Link href={`/artworks/${artwork.slug}`} className={styles.primaryLink}>
            Back to the Artwork Page
          </Link>
        </section>
      </main>
    </div>
  )
}
