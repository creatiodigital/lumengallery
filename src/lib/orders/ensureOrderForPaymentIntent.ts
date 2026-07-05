import { createPrintOrderFromCart } from '@/lib/orders/createPrintOrderFromCart'
import { createPrintOrderFromPaymentIntent } from '@/lib/orders/createPrintOrderFromPaymentIntent'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

import type { EnsureOrderResult } from './ensureOrderTypes'

/**
 * Guarantee that an authorized PaymentIntent has a PrintOrder.
 *
 * Called from the buyer confirmation step (and reusable by the reconcile cron)
 * so order creation no longer depends solely on the Stripe webhook: if the
 * webhook hasn't created the order yet, this creates it on the spot via the
 * SAME idempotent builder. Net effect — "authorized PaymentIntent in Stripe ⟹
 * PrintOrder in the dashboard" holds even if the webhook never fires (the exact
 * incident: forwarder/endpoint down).
 *
 * Idempotent: returns the existing order if one already exists (the webhook won
 * the race, or a prior call), and the builders themselves upsert on
 * paymentIntentId + gate their emails via the event log, so calling from both
 * the confirmation step and the webhook can't create duplicates or double-email.
 */
export async function ensureOrderForPaymentIntent(
  paymentIntentId: string,
): Promise<EnsureOrderResult> {
  // Already created (webhook won the race, or a prior ensure call)?
  const existing = await prisma.printOrder.findUnique({
    where: { paymentIntentId },
    select: { id: true },
  })
  if (existing) return { ok: true, orderId: existing.id, created: false }

  // Retrieve the PI to learn its kind (cart vs single-print) and confirm the
  // card is actually authorized before creating anything.
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null)
  if (!pi) {
    return { ok: false, error: `Could not retrieve PaymentIntent ${paymentIntentId} from Stripe.` }
  }

  // Only create once the card is authorized (held) or captured. Anything else
  // (requires_payment_method, canceled, …) means the buyer hasn't paid — there
  // is no order to create yet.
  if (pi.status !== 'requires_capture' && pi.status !== 'succeeded') {
    return {
      ok: false,
      error: `PaymentIntent ${paymentIntentId} is not authorized (status=${pi.status}).`,
    }
  }

  // Same dispatch the webhook uses; both builders are idempotent on
  // paymentIntentId. Cart PIs carry metadata.kind === 'cart' + a PendingCart
  // row; single-print PIs carry their order fields in metadata.
  const res =
    pi.metadata?.kind === 'cart'
      ? await createPrintOrderFromCart(pi)
      : await createPrintOrderFromPaymentIntent(pi)

  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, orderId: res.orderId, created: true }
}
