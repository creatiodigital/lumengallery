/**
 * Settle everything that hangs off a PaymentIntent Stripe has cancelled.
 *
 * An uncaptured authorization dies on its own after about seven days, and
 * Stripe emits `payment_intent.canceled` when it does. Everything downstream —
 * the edition number, the staged cart, the order's payment status — has to be
 * told, or the copy is out of stock forever and the order sits in "New"
 * offering a Capture button that can only fail.
 *
 * This is that routine, extracted so the webhook and the reconcile cron run
 * IDENTICAL logic. They are two paths to the same event: the webhook is the
 * fast one, the cron is the backstop for when the webhook does not arrive —
 * and it demonstrably does not, having been unregistered in the sandbox for
 * two months. Two copies of this logic would eventually disagree about what
 * "dead" settles, which is exactly the class of bug that produced the leak.
 *
 * Idempotent throughout: every write is a guarded `updateMany`, so running it
 * twice, or after the webhook already handled the same PaymentIntent, changes
 * nothing the second time.
 */
import prisma from '@/lib/prisma'
import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
import { logOrderEvent } from '@/lib/orders/logOrderEvent'

export type SettleActor = 'stripe' | 'cron'

export type SettleResult = {
  /** True when this call is the one that flipped the order to canceled. */
  orderCanceled: boolean
  /** Edition numbers returned to the available pool by this call. */
  numbersReleased: number
}

export async function settleDeadPaymentIntent(
  paymentIntentId: string,
  actor: SettleActor,
): Promise<SettleResult> {
  const order = await prisma.printOrder.findUnique({
    where: { paymentIntentId },
    select: { id: true },
  })

  // Count first: the release is an updateMany that reports rows touched, but we
  // want the number for the audit trail even when the order lookup misses.
  const heldBefore = await prisma.editionNumber.count({
    where: { paymentIntentId, state: 'reserved' },
  })

  // Return any held limited-edition number to the pool. Idempotent, and a
  // no-op for open editions.
  await releaseEditionNumberForPaymentIntent(paymentIntentId).catch((err) =>
    console.warn(`[settle-dead-pi] release edition number failed for ${paymentIntentId}:`, err),
  )

  // A cart PaymentIntent stages its lines in a PendingCart row that is only
  // consumed when the order is built. A dead PI never completed, so the row is
  // leftover. No-op for single-print PIs, or if it was already consumed.
  await prisma.pendingCart.delete({ where: { paymentIntentId } }).catch(() => {})

  // Never overwrite a terminal/captured state. Stripe does not guarantee event
  // ordering and can redeliver, so a stale `canceled` arriving after a
  // successful capture must not flip a paid order back to canceled.
  const flipped = await prisma.printOrder
    .updateMany({
      where: { paymentIntentId, paymentStatus: { notIn: ['succeeded', 'refunded', 'canceled'] } },
      data: { paymentStatus: 'canceled' },
    })
    .catch((err) => {
      console.warn(`[settle-dead-pi] update paymentStatus failed for ${paymentIntentId}:`, err)
      return { count: 0 }
    })

  const orderCanceled = flipped.count > 0

  // Log only when this call actually changed something. A redelivered webhook
  // or a second cron pass should not pile identical entries onto the timeline.
  if (order && (orderCanceled || heldBefore > 0)) {
    await logOrderEvent({
      orderId: order.id,
      kind: 'auth_canceled',
      // The event log's vocabulary is stripe | system | admin:<who>. A cron
      // pass is the system acting on its own, so it logs as `system` while the
      // message says which path found it.
      actor: actor === 'cron' ? 'system' : 'stripe',
      message:
        actor === 'cron'
          ? 'Authorization expired — found by reconciliation, order canceled and edition number released'
          : 'PaymentIntent canceled — auth released',
      payload: { paymentIntentId, numbersReleased: heldBefore },
    })
  }

  return { orderCanceled, numbersReleased: heldBefore }
}

/**
 * PaymentIntent statuses that mean the money is gone for good.
 *
 * Deliberately narrow. `requires_payment_method` and `requires_confirmation`
 * look dead but are still confirmable — a buyer may be mid-checkout — and
 * freeing a number under one of those is how the same copy gets sold twice.
 * Only Stripe's own terminal cancellation counts.
 */
export function isDeadPaymentIntentStatus(status: string): boolean {
  return status === 'canceled'
}
