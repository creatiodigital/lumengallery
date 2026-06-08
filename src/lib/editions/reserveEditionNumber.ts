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
    select: { editionSize: true, published: true },
  })
  if (!variant || !variant.published) return { ok: false, reason: 'not_found' }

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

/** Attach the Stripe PI id to a freshly reserved number. */
export async function attachPaymentIntentToReservation(
  numberId: string,
  paymentIntentId: string,
): Promise<void> {
  await prisma.editionNumber.update({
    where: { id: numberId },
    data: { paymentIntentId },
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

/** Confirm a bound number as sold at capture (admin markPlaced). */
export async function markEditionNumberSold(paymentIntentId: string): Promise<void> {
  await prisma.editionNumber.updateMany({
    where: { paymentIntentId, state: 'reserved' },
    data: { state: 'sold', soldAt: new Date() },
  })
}
