'use client'

import { useEffect, useRef, useState } from 'react'

import { AddressForm } from '@/components/checkout/AddressForm'
import { CartItemDetails } from '@/components/cart/CartItemDetails/CartItemDetails'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import { lineTotal } from '@/lib/cart/cartMath'
import type { CartItem } from '@/lib/cart/types'
import { hasLimitedItems } from '@/lib/cart/cartMath'
import { LIMITED_NOT_RESERVED_NOTICE } from '@/lib/cart/notices'
import { useCart } from '@/lib/cart/useCart'
import type { CartLikeItem, CartTotals } from '@/lib/cart/validateCart'
import { vatLabel } from '@/lib/checkout/vatLabel'
import { formatEuro } from '@/lib/print-providers'
import { getCountryName } from '@/lib/print-providers/dialCodes'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

import { CartConfirmation } from './CartConfirmation'
import { CartPayment } from './CartPayment'
import { createCartPaymentIntent } from './createCartPaymentIntent'
import { validateCartAction } from './validateCartAction'
import { verifyCartPaymentAction } from './verifyCartPaymentAction'

import styles from './CartCheckout.module.scss'

// Map a cart line to the minimal shape the server action needs. The server
// re-prices everything from the live catalog, so the display-snapshot cents
// are deliberately NOT sent.
const toCartLikeItem = (item: CartItem): CartLikeItem => ({
  lineId: item.lineId,
  artworkSlug: item.artworkSlug,
  providerId: item.providerId,
  config: item.config,
  variantId: item.variantId,
  editionType: item.editionType,
  quantity: item.quantity,
})

type Step = 'address' | 'review' | 'payment' | 'confirmation'

type CartCheckoutProps = {
  /** Provider-shippable countries — restricts the address country picker so a
   *  buyer can't choose a destination the server-side validation will reject. */
  supportedCountries: string[]
}

/**
 * Rewrite /checkout to carry ONLY the PaymentIntent id.
 *
 * The id is what lets a reload rebuild the confirmation. Stripe's redirect also
 * appends `payment_intent_client_secret` and `redirect_status`; the client
 * secret can confirm the PaymentIntent, so it has no business sitting in a URL
 * the buyer may bookmark, copy to us or paste into a support chat. It is
 * dropped here rather than merely ignored.
 */
function keepOnlyPaymentIntentInUrl(paymentIntentId: string): void {
  window.history.replaceState(
    null,
    '',
    `/checkout?payment_intent=${encodeURIComponent(paymentIntentId)}`,
  )
}

export const CartCheckout = ({ supportedCountries }: CartCheckoutProps) => {
  const { items, clear, removeItem } = useCart()

  // Becomes true the moment payment is authorized (no-redirect path) or a 3DS
  // return is verified. Suppresses the empty-cart view after clear() empties
  // the cart, so the confirmation step renders instead.
  const paidRef = useRef(false)
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState<ShippingAddress | null>(null)
  const [totals, setTotals] = useState<CartTotals | null>(null)
  // Set once createCartPaymentIntent succeeds; drives the Stripe Elements
  // mount on the payment step.
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Order-level error (e.g. empty cart, ceiling). Per-line failures are kept
  // separately so we can attach the message to the offending line.
  const [orderError, setOrderError] = useState<string | null>(null)
  // lineId → "no longer available" style message, surfaced on the line.
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [payError, setPayError] = useState<string | null>(null)

  // Redirect return path. Stripe sends the buyer back to return_url
  // (/checkout) with ?payment_intent=... — after 3DS on a card, and ALWAYS for
  // a redirect-based method like PayPal. Verify it server-side (never trust
  // redirect_status), then clear the cart and land on the confirmation step.
  //
  // This is also the reload path: the id stays in the URL precisely so a
  // refresh re-enters here and rebuilds the confirmation. Re-entry is
  // idempotent — the PI is re-read from Stripe, the order is fetched (or
  // created) by reference, and clear() no-ops on an emptied cart.
  const handledReturnRef = useRef(false)
  // True from the first render after mount when the URL names a PaymentIntent,
  // so the empty-cart view below yields while we verify. The cart IS empty on a
  // reload — it was cleared when the order was placed — and showing "your cart
  // is empty" over a completed order is exactly the bug this path fixes.
  const [restoringOrder, setRestoringOrder] = useState(false)
  useEffect(() => {
    if (handledReturnRef.current) return
    handledReturnRef.current = true
    const params = new URLSearchParams(window.location.search)
    const returnedPi = params.get('payment_intent')
    if (!returnedPi) return
    setRestoringOrder(true)
    void (async () => {
      const result = await verifyCartPaymentAction(returnedPi)
      if (!result.ok) {
        // Auth failed / unknown PI — drop the buyer back to the address step
        // with a retry message rather than a false success.
        setRestoringOrder(false)
        setPayError('Payment could not be completed. Please try again.')
        window.history.replaceState(null, '', '/checkout')
        return
      }
      paidRef.current = true
      setPaymentIntentId(result.paymentIntentId)
      setStep('confirmation')
      setRestoringOrder(false)
      await clear()
      keepOnlyPaymentIntentInUrl(result.paymentIntentId)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After a successful payment the cart is emptied — but we must keep showing
  // the confirmation, not the "empty cart" view. paidRef gates that, and
  // restoringOrder covers the reload, where paidRef starts false again.
  if (items.length === 0 && !paidRef.current && !restoringOrder) {
    return (
      <PageLayout>
        <PageHeader pageTitle="Checkout" />
        <div className={styles.empty}>
          <Text as="p" font="serif" size="lg" className={styles.emptyText}>
            Your cart is empty
          </Text>
          <Button variant="primary" size="bigSquared" href="/prints" label="Browse prints" />
        </div>
      </PageLayout>
    )
  }

  const handleAddressSubmit = async (submitted: ShippingAddress) => {
    setSubmitting(true)
    setOrderError(null)
    setLineErrors({})
    setPayError(null)
    try {
      const result = await validateCartAction(items.map(toCartLikeItem), submitted)
      if (!result.ok) {
        // Split failures into per-line (attach to the line) and order-level
        // (empty lineId, e.g. the total ceiling) so the buyer sees exactly
        // which item is the problem.
        const byLine: Record<string, string> = {}
        let order: string | null = null
        for (const f of result.failures) {
          if (f.lineId) byLine[f.lineId] = f.error
          else order = f.error
        }
        setLineErrors(byLine)
        setOrderError(order)
        // Stay on the address step with the cart context visible so the
        // buyer can fix/remove the offending line; do NOT advance.
        return
      }
      setAddress(submitted)
      setTotals(result.totals)
      setStep('review')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangeAddress = () => {
    setStep('address')
    setTotals(null)
    setPayError(null)
    // Discard any PI created for the old address. A later proceed re-runs
    // createCartPaymentIntent — identical inputs return the same PI
    // (idempotent), different inputs mint a new one; the abandoned PI's auth
    // expires/cancels via Stripe.
    setClientSecret(null)
    setPaymentIntentId(null)
  }

  // Return from the payment step to the review step without discarding the PI
  // (the same clientSecret remounts on a re-proceed). "Change address" is the
  // path that resets the PI.
  const handleBackToReview = () => {
    setStep('review')
    setPayError(null)
  }

  const handleProceedToPayment = async () => {
    if (!address) return
    setSubmitting(true)
    setPayError(null)
    try {
      const result = await createCartPaymentIntent({
        // Nothing is held client-side: the PI call claims every limited
        // number itself, atomically, and is the first and only moment stock
        // is decided.
        items: items.map(toCartLikeItem),
        address,
      })
      if (!result.ok) {
        // Sold-out / validation failure: surface inline and send the buyer
        // back to the address step where the per-line cart context shows
        // which item is the problem.
        // Sold out mid-checkout: drop exactly that line and let the buyer
        // continue with the rest. The message names the edition, so the cart
        // changing under them is explained rather than mysterious.
        if (result.soldOutLineId) await removeItem(result.soldOutLineId)
        setPayError(result.error)
        setStep('address')
        return
      }
      setClientSecret(result.clientSecret)
      setPaymentIntentId(result.paymentIntentId)
      setTotals(result.totals)
      setStep('payment')
    } catch {
      setPayError('Payment is not available right now. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  // Card authorized (manual capture → requires_capture). Mark paid BEFORE
  // clearing so the empty-cart guard yields to the confirmation step, then
  // clear the cart. clear() releases only still-unattached holds; this cart's
  // numbers now carry the PI, so releaseCartHolds no-ops on them — correct.
  const handlePaymentSuccess = (confirmedPaymentIntentId: string) => {
    paidRef.current = true
    setPaymentIntentId(confirmedPaymentIntentId)
    setStep('confirmation')
    void clear()
    // Same URL contract as the redirect path, so a reload rebuilds the
    // confirmation here too. Without it this branch — a card needing no 3DS —
    // held the order only in memory, and one refresh lost the reference.
    keepOnlyPaymentIntentInUrl(confirmedPaymentIntentId)
  }

  return (
    <PageLayout>
      <PageHeader pageTitle="Checkout" />

      {step === 'address' && (
        <div className={styles.addressStep}>
          <div className={styles.cartRecap}>
            <div className={styles.recapHeader}>
              <Text as="h2" font="serif" size="xl" className={styles.recapTitle}>
                Your order
              </Text>
              <Button variant="secondary" size="smallSquared" href="/cart" label="Edit cart" />
            </div>
            <div className={styles.lines}>
              {items.map((item) => (
                <CheckoutLine key={item.lineId} item={item} error={lineErrors[item.lineId]} />
              ))}
            </div>
            {orderError && (
              <Text as="p" size="sm" className={styles.orderError}>
                {orderError}
              </Text>
            )}
            {/* Said again here, at the last screen before money moves: a cart
                can sit for days, and availability moves while it does. */}
            {hasLimitedItems(items) && (
              <Text as="p" size="sm" className={styles.limitedNotice}>
                {LIMITED_NOT_RESERVED_NOTICE}
              </Text>
            )}
            {Object.keys(lineErrors).length > 0 && (
              <Text as="p" size="sm" className={styles.orderError}>
                Some items in your order are no longer available. Please update your cart and try
                again.
              </Text>
            )}
            {/* Payment-side failures route the buyer back here (sold-out at the
                PI call, or a failed 3DS return) — surface the message so it's
                not lost on the address step. */}
            {payError && (
              <Text as="p" size="sm" className={styles.orderError}>
                {payError}
              </Text>
            )}
          </div>

          <div className={styles.formPanel}>
            <AddressForm
              onSubmit={handleAddressSubmit}
              submitting={submitting}
              submitLabel="Continue to review"
              countryCodes={supportedCountries}
              initialAddress={address}
            />
          </div>
        </div>
      )}

      {step === 'review' && totals && address && (
        <div className={styles.reviewStep}>
          <div className={styles.cartRecap}>
            <div className={styles.recapHeader}>
              <Text as="h2" font="serif" size="xl" className={styles.recapTitle}>
                Your order
              </Text>
              <Button variant="secondary" size="smallSquared" href="/cart" label="Edit cart" />
            </div>
            <div className={styles.lines}>
              {items.map((item) => (
                <CheckoutLine key={item.lineId} item={item} />
              ))}
            </div>
          </div>

          <div className={styles.cartRecap}>
            <div className={styles.recapHeader}>
              <Text as="h2" font="serif" size="xl" className={styles.recapTitle}>
                Summary
              </Text>
            </div>

            <div className={styles.summaryPanel}>
              <div className={styles.shipTo}>
                <Text as="span" size="xs" className={styles.shipToLabel}>
                  Shipping to
                </Text>
                <Text as="span" size="sm" className={styles.shipToValue}>
                  {address.fullName}
                </Text>
                <Text as="span" size="sm" className={styles.shipToCountry}>
                  {getCountryName(address.countryCode)}
                </Text>
                <Button
                  variant="secondary"
                  size="smallSquared"
                  label="Change address"
                  onClick={handleChangeAddress}
                  className={styles.changeAddress}
                />
              </div>

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
                    {vatLabel(totals.vatRate)}
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

              {payError && (
                <Text as="p" size="sm" className={styles.orderError}>
                  {payError}
                </Text>
              )}

              <Button
                variant="primary"
                size="bigSquared"
                fullWidth
                disabled={submitting}
                label={submitting ? 'Preparing payment…' : 'Proceed to payment'}
                onClick={() => {
                  void handleProceedToPayment()
                }}
                className={styles.payCta}
              />
            </div>
          </div>
        </div>
      )}

      {step === 'payment' && totals && address && clientSecret && (
        <CartPayment
          clientSecret={clientSecret}
          totals={totals}
          address={address}
          onSuccess={handlePaymentSuccess}
          onBack={handleBackToReview}
        />
      )}

      {step === 'confirmation' && paymentIntentId && (
        <CartConfirmation paymentIntentId={paymentIntentId} />
      )}
    </PageLayout>
  )
}

type CheckoutLineProps = {
  item: CartItem
  /** Per-line "no longer available" message from the server revalidation. */
  error?: string
}

/**
 * Read-only order line for the checkout surfaces. Unlike the cart's CartLine
 * there are no quantity steppers or remove controls here — the buyer edits
 * quantities on the cart page; checkout just reflects the order.
 */
const CheckoutLine = ({ item, error }: CheckoutLineProps) => {
  const { lineItemCents } = lineTotal(item)
  return (
    <div className={`${styles.line} ${error ? styles.lineError : ''}`}>
      <CartItemDetails item={item} thumbHeight={88} error={error} />

      <div className={styles.qtyCol}>
        <div className={styles.qtyRow}>
          <Text as="span" size="sm" className={styles.qtyLabel}>
            Qty:
          </Text>
          <Text as="span" size="sm" className={styles.qtyValue}>
            {item.quantity}
          </Text>
        </div>

        <div className={styles.priceBlock}>
          <Text as="span" size="sm" className={styles.priceLabel}>
            Base price
          </Text>
          <Text as="span" font="serif" size="lg" className={styles.priceValue}>
            {formatEuro(lineItemCents)}
          </Text>
        </div>
      </div>
    </div>
  )
}
