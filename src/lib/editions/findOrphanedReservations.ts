/**
 * Phase B of the reconcile cron ([[project_guaranteed_order_capture]] Layer 3):
 * find limited-edition numbers stuck in `reserved` with a PaymentIntent attached
 * but never bound to an order — the orphaned-reservation leak.
 *
 * These rows are out of reach of every other release path:
 *  - the cart-hold TTL sweep (`sweepExpiredCartHolds`) skips rows with a PI;
 *  - the normal release (`releaseEditionNumberForPaymentIntent`) only runs from
 *    the Stripe `payment_intent.canceled`/`payment_failed` webhook — which is the
 *    thing that's down when this leak happens.
 *
 * Returns one entry per DISTINCT PaymentIntent (a quantity>=2 cart line reserves
 * several numbers against one PI) so the cron retrieves each PI from Stripe once
 * and decides bind-vs-release per PI.
 *
 * `cutoff` mirrors the cron's min-age: only reservations older than it are
 * considered, so an in-flight checkout that just attached its PI is left alone.
 */
import prisma from '@/lib/prisma'

export type OrphanedReservation = {
  paymentIntentId: string
  numberIds: string[]
}

export async function findOrphanedReservations(cutoff: Date): Promise<OrphanedReservation[]> {
  const rows = await prisma.editionNumber.findMany({
    where: {
      state: 'reserved',
      paymentIntentId: { not: null },
      orderId: null,
      orderItemId: null,
      reservedAt: { lt: cutoff },
    },
    select: { id: true, paymentIntentId: true },
  })

  const byPi = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.paymentIntentId) continue
    const ids = byPi.get(row.paymentIntentId) ?? []
    ids.push(row.id)
    byPi.set(row.paymentIntentId, ids)
  }

  return Array.from(byPi, ([paymentIntentId, numberIds]) => ({ paymentIntentId, numberIds }))
}
