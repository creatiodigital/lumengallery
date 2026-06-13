'use server'

import { stripe } from '@/lib/stripe/client'

/**
 * Verify a cart PaymentIntent server-side after a 3DS redirect back to
 * /checkout. NEVER trust the `redirect_status` querystring alone — we
 * re-fetch the PI from Stripe and read its real status.
 *
 * With manual capture a successful authorization lands the PI in
 * `requires_capture` (funds held, not yet charged) — from the buyer's
 * perspective the order is placed. `kind === 'cart'` is required so a
 * single-print or otherwise-foreign `pi_...` can't render a cart success.
 */
export type VerifyCartPaymentResult = { ok: true; paymentIntentId: string } | { ok: false }

export async function verifyCartPaymentAction(
  paymentIntentId: string,
): Promise<VerifyCartPaymentResult> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.metadata?.kind !== 'cart') return { ok: false }
    if (
      pi.status === 'requires_capture' ||
      pi.status === 'succeeded' ||
      pi.status === 'processing'
    ) {
      return { ok: true, paymentIntentId: pi.id }
    }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}
