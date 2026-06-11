/**
 * Release side of the limited-edition number ledger: return a held
 * number to the `available` pool so it can be sold again.
 *
 * Called whenever a reservation/order dies — Stripe `payment_intent`
 * `canceled` (covers auth-hold expiry) / `payment_failed`, and admin
 * `markRejected` / `deleteOrder` / `refundOrder`. Idempotent: releasing
 * an already-available number is a no-op.
 *
 * By default a `sold` number is NOT released (a captured, fulfilled
 * edition copy shouldn't silently reappear in the pool). Pass
 * `allowSold` for the reject/refund-before-delivery case, where the
 * physical print was never produced and the number should return.
 */
import prisma from '@/lib/prisma'

export async function releaseEditionNumberForPaymentIntent(
  paymentIntentId: string,
  opts?: { allowSold?: boolean },
): Promise<void> {
  const states = opts?.allowSold ? ['reserved', 'sold'] : ['reserved']
  await prisma.editionNumber.updateMany({
    where: { paymentIntentId, state: { in: states } },
    data: {
      state: 'available',
      paymentIntentId: null,
      orderId: null,
      buyerEmail: null,
      reservedAt: null,
      soldAt: null,
    },
  })
}

/** Release a specific reserved row by id (e.g. Stripe create failed after we reserved). */
export async function releaseEditionNumberById(numberId: string): Promise<void> {
  await prisma.editionNumber.updateMany({
    where: { id: numberId, state: 'reserved' },
    data: {
      state: 'available',
      paymentIntentId: null,
      orderId: null,
      buyerEmail: null,
      reservedAt: null,
      soldAt: null,
    },
  })
}
