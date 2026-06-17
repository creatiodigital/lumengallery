'use client'

import { useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Text } from '@/components/ui/Typography'
import type { CartTotals } from '@/lib/cart/validateCart'
import { formatEuro } from '@/lib/print-providers'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

import styles from './CartCheckout.module.scss'

// Stripe recommends loading the publishable key lazily and only once per
// page. Outside the component so it doesn't re-init on every render. Mirrors
// PrintPayment's setup exactly — the cart reuses the same Stripe Elements UI.
const stripePromise: Promise<Stripe | null> =
  typeof window === 'undefined'
    ? Promise.resolve(null)
    : loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

type CartPaymentProps = {
  clientSecret: string
  totals: CartTotals
  address: ShippingAddress
  /** Card authorized (manual capture). The parent clears the cart + shows
   *  the confirmation step. */
  onSuccess: (paymentIntentId: string) => void
  /** Return to the review step (e.g. "Back to review"). */
  onBack: () => void
}

/**
 * Cart payment view. Mounts the SAME Stripe Elements UI the single-print
 * PrintPayment uses (squared appearance, PaymentElement with billing
 * fields:'never', explicit billing_details on confirm). Built cart-specific
 * rather than reusing PrintPayment because that component is route- and
 * sessionStorage-coupled to a single artwork; the cart is an in-component
 * step machine over multiple line items.
 */
export const CartPayment = ({
  clientSecret,
  totals,
  address,
  onSuccess,
  onBack,
}: CartPaymentProps) => {
  const elementsOptions = useMemo(
    () => ({
      clientSecret,
      appearance: {
        theme: 'stripe' as const,
        // Client-facing UI is squared per the gallery design rule.
        variables: {
          borderRadius: '0px',
        },
      },
    }),
    [clientSecret],
  )

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <CartPaymentForm totals={totals} address={address} onSuccess={onSuccess} onBack={onBack} />
    </Elements>
  )
}

type CartPaymentFormProps = {
  totals: CartTotals
  address: ShippingAddress
  onSuccess: (paymentIntentId: string) => void
  onBack: () => void
}

const CartPaymentForm = ({ totals, address, onSuccess, onBack }: CartPaymentFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    // `redirect: 'if_required'` keeps the success path inside this
    // in-component step machine (no route round-trip): on a no-redirect
    // auth we read the PaymentIntent back here and advance to the
    // confirmation step ourselves. Stripe only redirects to return_url when
    // the card needs 3DS — return_url lands back on /checkout, where the
    // parent re-hydrates the PI from the querystring and verifies it
    // server-side.
    const returnUrl = `${window.location.origin}/checkout`
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        // We collected name/email/phone/address on the address step — pass
        // them explicitly so the PaymentElement can hide its own fields
        // (the native country <select> is a browser-default eyesore we
        // can't style inside Stripe's iframe). Use '' (not undefined) for
        // optional/unfilled fields — without this, EU buyers who skip
        // "State / region" hit a silent confirmPayment hang.
        payment_method_data: {
          billing_details: {
            name: address.fullName,
            email: address.email,
            phone: address.phone,
            address: {
              line1: address.address1,
              line2: address.address2,
              city: address.city,
              state: address.stateOrRegion,
              postal_code: address.postalCode,
              country: address.countryCode,
            },
          },
        },
      },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    // No redirect was required. With manual capture a successful authorization
    // lands the PI in `requires_capture`; treat that (and the rare immediate
    // `succeeded`) as done from the buyer's perspective.
    if (
      paymentIntent &&
      (paymentIntent.status === 'requires_capture' ||
        paymentIntent.status === 'succeeded' ||
        paymentIntent.status === 'processing')
    ) {
      onSuccess(paymentIntent.id)
      return
    }

    // Any other terminal state (e.g. requires_payment_method after a soft
    // decline) — surface a retry message and keep the buyer on this step.
    setError('Payment could not be completed. Please try again.')
    setSubmitting(false)
  }

  return (
    <div className={styles.paymentStep}>
      <div className={styles.paymentPanel}>
        <Text as="h2" font="serif" size="lg" className={styles.recapTitle}>
          Pay with card
        </Text>
        <Text as="p" size="sm" className={styles.paymentHelp}>
          All payments are processed securely by Stripe. Your card details never touch our servers.
          We&apos;ll hold your card now and charge it once your order enters production.
        </Text>
        <Text as="p" size="sm" className={styles.paymentHelp}>
          By placing your order you agree to our{' '}
          <a href="/terms-of-sale" target="_blank" rel="noopener noreferrer">
            Online Terms of Sale
          </a>
          .
        </Text>

        <form id="cart-payment-form" onSubmit={handleSubmit} className={styles.paymentForm}>
          <PaymentElement
            options={{
              layout: 'tabs',
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
          {error && (
            <Text as="p" size="sm" className={styles.paymentError}>
              {error}
            </Text>
          )}
        </form>

        <div className={styles.backRow}>
          <Button
            variant="secondary"
            size="bigSquared"
            label="Back to review"
            iconLeft={<Icon name="arrowLeft" size={20} />}
            onClick={onBack}
            disabled={submitting}
          />
        </div>
      </div>

      <div className={styles.summaryPanel}>
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <Text as="span" size="sm" className={styles.totalLabel}>
              Items
            </Text>
            <Text as="span" size="sm" className={styles.totalValue}>
              {formatEuro(totals.itemsPreTaxCents)}
            </Text>
          </div>
          <div className={styles.totalRow}>
            <Text as="span" size="sm" className={styles.totalLabel}>
              Shipping
            </Text>
            <Text as="span" size="sm" className={styles.totalValue}>
              {formatEuro(totals.shippingCents)}
            </Text>
          </div>
          <div className={styles.totalRow}>
            <Text as="span" size="sm" className={styles.totalLabel}>
              VAT
            </Text>
            <Text as="span" size="sm" className={styles.totalValue}>
              {formatEuro(totals.customerVatCents)}
            </Text>
          </div>
          <div className={`${styles.totalRow} ${styles.grandTotalRow}`}>
            <Text as="span" size="md" className={styles.grandTotalLabel}>
              Total
            </Text>
            <Text as="span" font="serif" size="xl" className={styles.grandTotalValue}>
              {formatEuro(totals.totalCents)}
            </Text>
          </div>
        </div>

        <Button
          type="submit"
          form="cart-payment-form"
          variant="primary"
          size="bigSquared"
          fullWidth
          disabled={!stripe || !elements || submitting}
          label={submitting ? 'Processing…' : `Pay ${formatEuro(totals.totalCents)}`}
          className={styles.payCta}
        />
      </div>
    </div>
  )
}
