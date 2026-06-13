'use server'

import type { CartLikeItem } from '@/lib/cart/validateCart'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

/**
 * SEAM for AR-129 Task 8 — multi-item (cart) PaymentIntent creation.
 *
 * Task 7 stops at server-authoritative validation + totals (validateCart).
 * Task 8 owns persistence: it will re-run validateCart server-side (never
 * trusting the totals the client already saw), create the PendingCart row +
 * a single Stripe PaymentIntent for the whole order, reserve any limited
 * edition numbers, and return a clientSecret for the payment step.
 *
 * It is exported + typed now so the "Proceed to payment" button in
 * CartCheckout already calls a stable signature; Task 8 only fills in the
 * body and widens the result type to carry the clientSecret/PI id.
 *
 * Intentionally throws today — this MUST NOT be reachable in a shipped build
 * until Task 8 lands. See the TODO in CartCheckout.tsx.
 */
export type CreateCartPaymentIntentInput = {
  items: CartLikeItem[]
  address: ShippingAddress
}

export type CreateCartPaymentIntentResult = { ok: false; error: string }

export async function createCartPaymentIntent(
  _input: CreateCartPaymentIntentInput,
): Promise<CreateCartPaymentIntentResult> {
  // TODO(AR-129 Task 8): implement PendingCart + Stripe PaymentIntent
  // creation. Until then this is a hard stop so checkout can't silently
  // complete with no charge.
  throw new Error('createCartPaymentIntent: not implemented (AR-129 Task 8)')
}
