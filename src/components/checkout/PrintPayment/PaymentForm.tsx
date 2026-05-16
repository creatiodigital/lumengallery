'use client'

import { useState } from 'react'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { formatEuro } from '@/lib/print-providers'

import type { CheckoutArtwork } from '../PrintCheckout'
import { OrderSummary } from '../OrderSummary'

import type { StashedPayment } from './types'

import styles from './PrintPayment.module.scss'

interface PaymentFormProps {
  stashed: StashedPayment
  artwork: CheckoutArtwork
  country: string
  artworkSlug: string
  onBack: () => void
}

// The `form` attribute on the sidebar's submit button points here so a click
// in the aside still submits the card form in the main panel.
const FORM_ID = 'print-payment-form'

export const PaymentForm = ({
  stashed,
  artwork,
  country,
  artworkSlug,
  onBack,
}: PaymentFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { totalCents, customerVatCents } = stashed.totals
  const subtotalCents = totalCents - customerVatCents
  const vatLabel =
    customerVatCents > 0 && subtotalCents > 0
      ? `VAT (${Math.round((customerVatCents * 100) / subtotalCents)}%)`
      : 'VAT'

  const customSize = stashed.config.customSize
  const orientation: 'portrait' | 'landscape' =
    customSize && customSize.widthCm > customSize.heightCm ? 'landscape' : 'portrait'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const returnUrl = `${window.location.origin}/artworks/${artworkSlug}/print/confirmation`

    // confirmPayment either resolves with an error (validation, declined
    // card) or redirects away to Stripe's hosted flow for 3DS and then
    // comes back to return_url. On success with no redirect needed, it
    // also returns here with no error — but the user still gets pushed
    // to return_url automatically unless `redirect: 'if_required'` is
    // set. We let Stripe handle the redirect so we don't have to manage
    // the success-path state ourselves.
    const addr = stashed.address
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        // We already collected these on step 2 — pass them explicitly so
        // the PaymentElement can hide its own address fields (the native
        // country <select> is a browser-default eyesore we can't style
        // inside Stripe's iframe).
        payment_method_data: {
          billing_details: {
            // Every billing-details field is configured with `fields:
            // 'never'` on the PaymentElement above, which means Stripe
            // requires us to pass each one explicitly here — including
            // optional ones the buyer left blank. Using `''` (not
            // `undefined`) for optional/unfilled fields keeps Stripe
            // happy. Without this, EU buyers who skip the optional
            // "State / region" field hit a silent confirmPayment hang.
            name: addr.fullName,
            email: addr.email,
            phone: addr.phone,
            address: {
              line1: addr.address1,
              line2: addr.address2,
              city: addr.city,
              state: addr.stateOrRegion,
              postal_code: addr.postalCode,
              country: addr.countryCode,
            },
          },
        },
      },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    }
    // On success Stripe redirects — we won't reach this line.
  }

  return (
    <>
      <section className={styles.paymentPanel}>
        <h2 className={styles.sectionTitle}>Pay with card</h2>
        <p className={styles.sectionHelp}>
          All payments are processed securely by Stripe. Your card details never touch our servers.
          We&apos;ll hold your card now and charge it once your print enters production.
        </p>
        <p className={styles.sectionHelp}>
          By placing your order you agree to our{' '}
          <a href="/terms-of-sale" target="_blank" rel="noopener noreferrer">
            Online Terms of Sale
          </a>
          .
        </p>

        <form id={FORM_ID} onSubmit={handleSubmit} className={styles.paymentForm}>
          <PaymentElement
            options={{
              layout: 'tabs',
              // We collected name/email/phone/address on the checkout step
              // and pass them to Stripe via payment_method_data in
              // confirmPayment. 'never' hides the fields Stripe would
              // otherwise render — including the native country <select>
              // inside its iframe, which we can't style.
              fields: {
                billingDetails: {
                  name: 'never',
                  email: 'never',
                  phone: 'never',
                  address: 'never',
                },
              },
            }}
          />

          {error && <p className={styles.paymentError}>{error}</p>}
        </form>

        <div className={styles.backRow}>
          <Button
            variant="secondary"
            size="bigSquared"
            label="Back to shipping"
            iconLeft={<Icon name="arrowLeft" size={20} />}
            onClick={onBack}
            disabled={submitting}
          />
        </div>
      </section>

      <OrderSummary
        artwork={{
          title: artwork.title,
          artistName: artwork.artistName,
          year: artwork.year,
          imageUrl: artwork.imageUrl,
          originalWidthPx: artwork.originalWidthPx,
          originalHeightPx: artwork.originalHeightPx,
        }}
        specs={stashed.specs}
        orientation={orientation}
        country={country}
        priceLines={[
          { label: 'Subtotal', value: formatEuro(subtotalCents) },
          { label: vatLabel, value: formatEuro(customerVatCents) },
        ]}
        total={{ label: 'Total', value: formatEuro(totalCents) }}
        cta={{
          kind: 'submit',
          label: submitting ? 'Processing…' : `Pay ${formatEuro(totalCents)}`,
          form: FORM_ID,
          disabled: !stripe || !elements || submitting,
        }}
      />
    </>
  )
}
