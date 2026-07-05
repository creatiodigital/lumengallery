'use server'

import { ensureOrderForPaymentIntent } from './ensureOrderForPaymentIntent'

/**
 * Client-callable wrapper around ensureOrderForPaymentIntent, used by the buyer
 * confirmation step to GATE the "your order is confirmed" message: it returns
 * ok only once a real PrintOrder exists (creating it idempotently if the webhook
 * hasn't). Returns just the boolean — no internal detail — to the client.
 */
export async function ensureOrderAction(paymentIntentId: string): Promise<{ ok: boolean }> {
  const res = await ensureOrderForPaymentIntent(paymentIntentId)
  return { ok: res.ok }
}
