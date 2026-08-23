'use server'

import prisma from '@/lib/prisma'
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
 *
 * Also reports whether the order holds a limited edition, which decides the
 * "your edition number" notice. Derived from the ORDER rather than the cart the
 * buyer just had: the cart is emptied on success, so a reload has nothing left
 * to read, and the confirmation must survive a reload.
 */
export async function ensureOrderAction(
  paymentIntentId: string,
): Promise<{ ok: boolean; orderRef?: string; hasLimitedEdition?: boolean }> {
  const res = await ensureOrderForPaymentIntent(paymentIntentId)
  if (!res.ok) return { ok: false }
  // An edition number bound to the order is the fact itself — truer than
  // re-deriving "was this limited?" from a config snapshot.
  const limitedCount = await prisma.editionNumber.count({
    where: { OR: [{ orderId: res.orderId }, { orderItem: { orderId: res.orderId } }] },
  })
  return {
    ok: true,
    orderRef: formatOrderRef(res.orderId),
    hasLimitedEdition: limitedCount > 0,
  }
}
