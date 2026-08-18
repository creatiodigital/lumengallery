'use server'

import { ensureOrderForPaymentIntent } from './ensureOrderForPaymentIntent'
import { formatOrderRef } from './orderRef'

/**
 * Client-callable wrapper around ensureOrderForPaymentIntent, used by the buyer
 * confirmation step to GATE the "your order is confirmed" message: it returns
 * ok only once a real PrintOrder exists (creating it idempotently if the webhook
 * hasn't).
 *
 * Returns the buyer-facing order REFERENCE alongside the flag — the same string
 * every email and the invoice print, so the confirmation screen can show the
 * customer the one identifier they should ever quote back to us. The internal
 * UUID stays server-side; only its 8-character reference crosses to the client.
 */
export async function ensureOrderAction(
  paymentIntentId: string,
): Promise<{ ok: boolean; orderRef?: string }> {
  const res = await ensureOrderForPaymentIntent(paymentIntentId)
  if (!res.ok) return { ok: false }
  return { ok: true, orderRef: formatOrderRef(res.orderId) }
}
