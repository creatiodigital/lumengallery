'use client'

import { useEffect, useRef, useState } from 'react'

import { AddressForm } from '@/components/checkout/AddressForm'
import { HoldCountdown } from '@/components/cart/HoldCountdown/HoldCountdown'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { SpecList } from '@/components/print/SpecList/SpecList'
import { Text } from '@/components/ui/Typography'
import type { CartItem } from '@/lib/cart/types'
import { useCart } from '@/lib/cart/useCart'
import type { CartLikeItem, CartTotals } from '@/lib/cart/validateCart'
import { formatEuro } from '@/lib/print-providers'
import { getCountryName } from '@/lib/print-providers/dialCodes'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

import { createCartPaymentIntent } from './createCartPaymentIntent'
import { validateCartAction } from './validateCartAction'

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

type Step = 'address' | 'review'

// Mirror the cart page heartbeat so an engaged buyer's limited-edition hold
// doesn't lapse while they fill in the address / review the order. Well under
// the ~15-min server TTL; the server still owns the clock. Kept identical to
// CartPage.HOLD_HEARTBEAT_MS.
const HOLD_HEARTBEAT_MS = 5 * 60 * 1000

export const CartCheckout = () => {
  const { items, extendHolds } = useCart()

  // Keep limited-edition holds alive on the checkout surface too. Without this
  // a buyer could sit on /checkout past the TTL and only discover the loss at
  // Task 8's submit-time re-verify. The visible per-line HoldCountdown (below)
  // mirrors the server's expiresAt so expiry is never silent here.
  const hasLimitedHolds = items.some(
    (item) => item.editionType === 'limited' && !!item.editionNumberIds?.length,
  )
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

  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState<ShippingAddress | null>(null)
  const [totals, setTotals] = useState<CartTotals | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Order-level error (e.g. empty cart, ceiling). Per-line failures are kept
  // separately so we can attach the message to the offending line.
  const [orderError, setOrderError] = useState<string | null>(null)
  // lineId → "no longer available" style message, surfaced on the line.
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [payError, setPayError] = useState<string | null>(null)

  if (items.length === 0) {
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
  }

  // SEAM → AR-129 Task 8. Today createCartPaymentIntent throws; we surface a
  // friendly message rather than crash. Task 8 swaps the body for a real
  // PaymentIntent and routes the buyer to the payment step.
  const handleProceedToPayment = async () => {
    if (!address) return
    setSubmitting(true)
    setPayError(null)
    try {
      const result = await createCartPaymentIntent({
        items: items.map(toCartLikeItem),
        address,
      })
      // Unreachable until Task 8 returns ok:true — the stub throws.
      if (!result.ok) {
        setPayError(result.error)
      }
    } catch {
      setPayError('Payment is not available yet. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout>
      <PageHeader pageTitle="Checkout" />

      {step === 'address' && (
        <div className={styles.addressStep}>
          <div className={styles.cartRecap}>
            <Text as="h2" font="serif" size="lg" className={styles.recapTitle}>
              Your order
            </Text>
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
            {Object.keys(lineErrors).length > 0 && (
              <Text as="p" size="sm" className={styles.orderError}>
                Some items in your order are no longer available. Please update your cart and try
                again.
              </Text>
            )}
          </div>

          <div className={styles.formPanel}>
            <AddressForm
              onSubmit={handleAddressSubmit}
              submitting={submitting}
              submitLabel="Continue to review"
            />
          </div>
        </div>
      )}

      {step === 'review' && totals && address && (
        <div className={styles.reviewStep}>
          <div className={styles.cartRecap}>
            <div className={styles.recapHeader}>
              <Text as="h2" font="serif" size="lg" className={styles.recapTitle}>
                Your order
              </Text>
            </div>
            <div className={styles.lines}>
              {items.map((item) => (
                <CheckoutLine key={item.lineId} item={item} />
              ))}
            </div>
          </div>

          <div className={styles.summaryPanel}>
            <div className={styles.shipTo}>
              <Text as="span" size="xs" className={styles.shipToLabel}>
                Shipping to
              </Text>
              <Text as="span" size="sm" className={styles.shipToValue}>
                {address.fullName}, {getCountryName(address.countryCode)}
              </Text>
              <Button
                variant="ghost"
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

            {payError && (
              <Text as="p" size="sm" className={styles.orderError}>
                {payError}
              </Text>
            )}

            {/* SEAM → AR-129 Task 8: wire this to the real cart PaymentIntent.
                Today createCartPaymentIntent throws and we show payError. Do
                NOT ship cart checkout to users until Task 8 lands. */}
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
  return (
    <div className={`${styles.line} ${error ? styles.lineError : ''}`}>
      <div className={styles.thumb}>
        <ProtectedImage
          src={item.thumbnailUrl}
          alt={item.title}
          width={88}
          height={88}
          style={{ height: 88, width: 'auto' }}
        />
      </div>

      <div className={styles.details}>
        <Text as="span" size="xs" className={styles.artist}>
          {item.artistName}
        </Text>
        <Text as="p" font="serif" size="md" className={styles.title}>
          {item.title}
        </Text>
        <SpecList specs={item.specsSummary} visibleByDefault={3} />
        {item.editionType === 'limited' && (
          <Text as="span" size="xs" className={styles.editionTag}>
            Limited edition
          </Text>
        )}
        {item.editionType === 'limited' && item.holdExpiresAt && (
          // Read-only surface: no onExpire/remove here (the buyer edits on
          // /cart). HoldCountdown renders its own expired state; Task 8's
          // submit-time re-verify is the authority on dropping/re-reserving a
          // lapsed hold.
          <HoldCountdown expiresAt={item.holdExpiresAt} />
        )}
        {error && (
          <Text as="span" size="xs" className={styles.lineErrorText}>
            {error}
          </Text>
        )}
      </div>

      <div className={styles.qtyCol}>
        <Text as="span" size="sm" className={styles.qty}>
          Qty {item.quantity}
        </Text>
      </div>
    </div>
  )
}
