/**
 * Forward lifecycle for the limited-edition number ledger
 * (`EditionNumber`). Our DB is the authoritative source of truth for
 * which copy of an edition has sold; TPS is mirrored by hand from it.
 *
 * State machine:
 *   available → reserved          (reserveNextEditionNumber, at PI create)
 *   reserved  → +paymentIntentId  (attachPaymentIntentToReservation)
 *   reserved  → +orderId / bound  (bindEditionNumberToOrder, at auth)
 *   reserved  → sold              (markEditionNumberSold, at capture)
 *
 * Release (reserved/sold → available) lives in `releaseEditionNumber.ts`.
 *
 * The atomic claim uses Postgres `FOR UPDATE SKIP LOCKED` so two buyers
 * checking out the same variant at the same instant get different
 * numbers (one grabs 7, the other skips the locked row and grabs 8).
 * The `@@unique([variantId, number])` constraint is the belt-and-braces
 * backstop.
 */
import { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'

export type ReserveResult =
  | { ok: true; numberId: string; number: number; editionSize: number }
  | { ok: false; reason: 'sold_out' | 'not_found' }

/**
 * Atomically claim the lowest available number for a variant and mark it
 * `reserved`. The PI id is attached separately once Stripe returns it
 * (`attachPaymentIntentToReservation`) — Stripe mints the id, so we
 * reserve first, then attach.
 */
export async function reserveNextEditionNumber(args: {
  variantId: string
  buyerEmail: string
}): Promise<ReserveResult> {
  const { variantId, buyerEmail } = args

  const variant = await prisma.limitedVariant.findUnique({
    where: { id: variantId },
    select: { editionSize: true, published: true, blocked: true },
  })
  // An unblocked variant is paused from sale (admin is editing it) — refuse
  // reservations just like an unpublished one.
  if (!variant || !variant.published || !variant.blocked) {
    return { ok: false, reason: 'not_found' }
  }

  // Single-statement atomic claim. The inner SELECT locks just the one
  // chosen row; concurrent callers SKIP LOCKED past it to the next.
  const claimed = await prisma.$queryRaw<{ id: string; number: number }[]>(Prisma.sql`
    UPDATE "EditionNumber"
    SET "state" = 'reserved', "reservedAt" = now(), "buyerEmail" = ${buyerEmail}, "updatedAt" = now()
    WHERE "id" = (
      SELECT "id" FROM "EditionNumber"
      WHERE "variantId" = ${variantId} AND "state" = 'available'
      ORDER BY "number" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "number";
  `)

  const row = claimed[0]
  if (!row) return { ok: false, reason: 'sold_out' }

  return { ok: true, numberId: row.id, number: row.number, editionSize: variant.editionSize }
}

/** Attach the Stripe PI id to a freshly reserved number. Also restarts the
 *  reservation clock: reservedAt was stamped at add-to-cart, and the
 *  reconcile cron's abandonment cutoff must count from checkout start — not
 *  from browsing — or a slow browser can lose their number mid-payment. */
export async function attachPaymentIntentToReservation(
  numberId: string,
  paymentIntentId: string,
): Promise<void> {
  await prisma.editionNumber.update({
    where: { id: numberId },
    data: { paymentIntentId, reservedAt: new Date() },
  })
}

/**
 * Bind a reserved number to its PrintOrder at auth (order creation).
 * Idempotent: re-binding the same order is a no-op. Returns false if the
 * number is no longer held by this PI (released before auth landed) so
 * the caller can raise a reconciliation alert.
 */
export async function bindEditionNumberToOrder(args: {
  paymentIntentId: string
  orderId: string
  buyerEmail: string
}): Promise<boolean> {
  const { paymentIntentId, orderId, buyerEmail } = args
  const row = await prisma.editionNumber.findFirst({
    where: { paymentIntentId },
    select: { id: true, state: true, orderId: true },
  })
  if (!row) return false
  if (row.orderId === orderId) return true // already bound
  if (row.state !== 'reserved' || row.orderId) return false

  await prisma.editionNumber.update({
    where: { id: row.id },
    data: { orderId, buyerEmail },
  })
  return true
}

/**
 * Bind specific reserved cart-held numbers to their PrintOrderItem at
 * order creation. The numbers already carry the PI (attached in
 * createCartPaymentIntent); this adds the per-item link. Returns the count
 * bound. Idempotent: re-running binds nothing new (rows whose orderItemId is
 * already set fall outside the WHERE). Empty input is a no-op.
 *
 * One statement: orderItemId is a one-to-many FK (PrintOrderItem.editionNumbers),
 * so a quantity>=2 limited line binds all its numbers to the same orderItemId
 * here. The caller compares the returned count to the expected quantity and
 * raises a reconciliation alert (not an order failure) on any shortfall.
 */
export async function bindEditionNumbersToOrderItem(args: {
  numberIds: string[]
  orderItemId: string
  buyerEmail: string
  paymentIntentId: string
}): Promise<number> {
  const { numberIds, orderItemId, buyerEmail, paymentIntentId } = args
  if (numberIds.length === 0) return 0

  // paymentIntentId in the WHERE is the ownership check (mirrors the
  // single-print bindEditionNumberToOrder): a number that was released and
  // re-reserved by ANOTHER buyer carries a different PI, so a delayed webhook
  // replaying this order's stored numberIds can never steal it — it shows up
  // as a bind shortfall (reconciliation alert) instead.
  const result = await prisma.editionNumber.updateMany({
    where: {
      id: { in: numberIds },
      state: 'reserved',
      orderItemId: null,
      paymentIntentId,
    },
    data: { orderItemId, buyerEmail },
  })
  return result.count
}

/** Confirm a bound number as sold at capture (admin markPlaced). */
export async function markEditionNumberSold(paymentIntentId: string): Promise<void> {
  await prisma.editionNumber.updateMany({
    where: { paymentIntentId, state: 'reserved' },
    data: { state: 'sold', soldAt: new Date() },
  })
}
