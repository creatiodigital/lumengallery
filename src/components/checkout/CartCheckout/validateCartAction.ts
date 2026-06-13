'use server'

import { validateCart } from '@/lib/cart/validateCart'
import type { CartLikeItem, CartTotals, CartValidationFailure } from '@/lib/cart/validateCart'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

/**
 * Thin server-action wrapper around validateCart so the client CartCheckout
 * component can revalidate + price the cart server-side. We pass only the
 * minimal per-line fields validateCart needs (CartLikeItem) — never the
 * display snapshot cents, since the server re-prices everything from the
 * live catalog and treats the client numbers as untrusted.
 *
 * The result mirrors validateCart's discriminated union verbatim: on success
 * the order totals, on failure the per-line failures (used to mark the
 * offending cart lines as no-longer-available).
 */
export async function validateCartAction(
  items: CartLikeItem[],
  address: ShippingAddress,
): Promise<{ ok: true; totals: CartTotals } | { ok: false; failures: CartValidationFailure[] }> {
  return validateCart(items, address)
}
