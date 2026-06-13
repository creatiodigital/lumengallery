/**
 * Cart-hold lifecycle for limited-edition numbers (AR-129).
 *
 * A CART HOLD is an `EditionNumber` row in the gap between "added to cart"
 * and "checkout started": `state='reserved'`, `reservedAt=now()`,
 * `paymentIntentId=NULL`, `orderItemId=NULL` — reserved stock that is not
 * yet tied to any Stripe PaymentIntent or order. The server owns the clock;
 * localStorage only mirrors the returned `numberIds`/`expiresAt`.
 *
 * TTL governs ONLY the no-PI window. Once checkout attaches a PI (or an
 * order item is bound), the row is no longer a cart hold and the sweep must
 * not touch it. Releasing is all-or-nothing per add: a partial reservation
 * is released so the buyer never holds an unusable fragment of an edition.
 */
import { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'

import { reserveNextEditionNumber } from './reserveEditionNumber'
import { releaseEditionNumberById } from './releaseEditionNumber'

export const CART_HOLD_TTL_MS = 15 * 60 * 1000

export type ReserveForCartResult =
  | { ok: true; numberIds: string[]; reserved: number; expiresAt: number }
  | {
      ok: false
      reason: 'sold_out' | 'not_found' | 'insufficient_stock'
      reserved: number
      available: number
    }

/**
 * Release all expired CART holds in a single atomic UPDATE, returning the
 * number of rows freed. Scoped EXACTLY to cart holds so it can never yank a
 * single-print reservation (PI set at PI-create), an in-flight cart checkout
 * (PI attached), an order-bound row (orderItemId set), or a sold copy.
 */
export async function sweepExpiredCartHolds(): Promise<number> {
  const cutoff = new Date(Date.now() - CART_HOLD_TTL_MS)
  return prisma.$executeRaw(Prisma.sql`
    UPDATE "EditionNumber"
    SET "state" = 'available', "reservedAt" = NULL, "buyerEmail" = NULL, "updatedAt" = now()
    WHERE "state" = 'reserved'
      AND "paymentIntentId" IS NULL
      AND "orderItemId" IS NULL
      AND "reservedAt" < ${cutoff};
  `)
}

/**
 * Reserve `quantity` edition numbers as cart holds for a variant, all or
 * nothing. Sweeps expired holds first (lazy-on-read TTL), then claims one
 * number at a time. On any shortfall the partial claim is released and a
 * failure is returned with how many COULD be had.
 */
export async function reserveForCart(args: {
  variantId: string
  quantity: number
}): Promise<ReserveForCartResult> {
  const { variantId, quantity } = args

  await sweepExpiredCartHolds()

  const collected: string[] = []

  for (let i = 0; i < quantity; i++) {
    const result = await reserveNextEditionNumber({ variantId, buyerEmail: '' })

    if (!result.ok) {
      // Roll back everything we grabbed this call — an add is atomic.
      for (const id of collected) {
        await releaseEditionNumberById(id)
      }

      if (result.reason === 'not_found') {
        return {
          ok: false,
          reason: 'not_found',
          reserved: collected.length,
          available: collected.length,
        }
      }

      // sold_out mid-loop: we secured fewer than asked. `available` reports
      // how many were claimable so the UI can offer a smaller quantity.
      return {
        ok: false,
        reason: collected.length === 0 ? 'sold_out' : 'insufficient_stock',
        reserved: 0,
        available: collected.length,
      }
    }

    collected.push(result.numberId)
  }

  return {
    ok: true,
    numberIds: collected,
    reserved: quantity,
    expiresAt: Date.now() + CART_HOLD_TTL_MS,
  }
}

/**
 * Release the given numbers, but ONLY while they are still cart holds
 * (`state='reserved'`, no PI, no order item). A single guarded `updateMany`
 * so we never release a number that has since advanced to checkout.
 *
 * Ownership scoping (no extra column): the caller passes the `expiresAt` it
 * holds for these rows. We translate that back to the `reservedAt` it implies
 * (`expiresAt - TTL`) and only release rows whose `reservedAt` has NOT been
 * refreshed past it. This stops a stale tab from freeing a number that the TTL
 * sweep already reclaimed and another buyer has since re-reserved (a NEWER
 * `reservedAt`): that fresh hold belongs to someone else and is left untouched.
 * Omitting `knownExpiresAt` releases unconditionally (server-trusted callers).
 */
export async function releaseCartHolds(
  numberIds: string[],
  knownExpiresAt?: number,
): Promise<void> {
  if (numberIds.length === 0) return
  const where: Prisma.EditionNumberWhereInput = {
    id: { in: numberIds },
    state: 'reserved',
    paymentIntentId: null,
    orderItemId: null,
  }
  if (typeof knownExpiresAt === 'number') {
    // Only my hold: a re-reserved row has a strictly newer reservedAt.
    where.reservedAt = { lte: new Date(knownExpiresAt - CART_HOLD_TTL_MS) }
  }
  await prisma.editionNumber.updateMany({
    where,
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

/**
 * Refresh `reservedAt=now()` for still-held cart rows so an engaged buyer's
 * cart doesn't expire under them. Returns the new `expiresAt`. Rows that have
 * advanced to checkout (PI/order item set) are left untouched.
 */
export async function extendCartHold(numberIds: string[]): Promise<number> {
  if (numberIds.length > 0) {
    await prisma.editionNumber.updateMany({
      where: { id: { in: numberIds }, state: 'reserved', paymentIntentId: null, orderItemId: null },
      data: { reservedAt: new Date() },
    })
  }
  return Date.now() + CART_HOLD_TTL_MS
}
