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

// Absolute lifetime cap for a cart hold, independent of TTL refreshes. Even a
// continuously-extended hold is reclaimed once it is this old, so a griefer
// can't freeze limited-edition stock indefinitely by looping /api/cart/extend.
export const CART_HOLD_MAX_LIFETIME_MS = 30 * 60 * 1000

// Max edition numbers one cart session may hold at once (across all variants).
// Caps how much stock a single anonymous session can freeze; combined with
// per-IP/session rate limiting on reserve, this bounds the DoS surface.
export const MAX_SESSION_HOLDS = 25

export type ReserveForCartResult =
  | { ok: true; numberIds: string[]; reserved: number; expiresAt: number }
  | {
      ok: false
      reason: 'sold_out' | 'not_found' | 'insufficient_stock' | 'too_many_holds'
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
  const ttlCutoff = new Date(Date.now() - CART_HOLD_TTL_MS)
  const lifetimeCutoff = new Date(Date.now() - CART_HOLD_MAX_LIFETIME_MS)
  return prisma.$executeRaw(Prisma.sql`
    UPDATE "EditionNumber"
    SET "state" = 'available', "reservedAt" = NULL, "buyerEmail" = NULL,
        "cartSessionId" = NULL, "holdStartedAt" = NULL, "updatedAt" = now()
    WHERE "state" = 'reserved'
      AND "paymentIntentId" IS NULL
      AND "orderItemId" IS NULL
      AND (
        "reservedAt" < ${ttlCutoff}
        OR ("holdStartedAt" IS NOT NULL AND "holdStartedAt" < ${lifetimeCutoff})
      );
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
  cartSessionId: string
}): Promise<ReserveForCartResult> {
  const { variantId, quantity, cartSessionId } = args

  await sweepExpiredCartHolds()

  // Aggregate cap: a single session can't freeze more than MAX_SESSION_HOLDS
  // numbers across all variants. Checked after the sweep so expired holds don't
  // count against the caller.
  const heldBySession = await prisma.editionNumber.count({
    where: { cartSessionId, state: 'reserved', paymentIntentId: null, orderItemId: null },
  })
  if (heldBySession + quantity > MAX_SESSION_HOLDS) {
    return {
      ok: false,
      reason: 'too_many_holds',
      reserved: 0,
      available: Math.max(0, MAX_SESSION_HOLDS - heldBySession),
    }
  }

  const collected: string[] = []

  for (let i = 0; i < quantity; i++) {
    const result = await reserveNextEditionNumber({ variantId, buyerEmail: '', cartSessionId })

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
 * Ownership scoping: the caller passes the `cartSessionId` from its httpOnly
 * cookie; only holds placed by that session are released. `cartSessionId`
 * semantics:
 *   - a string  → client request: scope to that session (the primary guard).
 *   - null      → client request with NO cart-session cookie: it owns nothing,
 *                 so release nothing (never fall through to the unscoped path).
 *   - undefined → server-trusted caller: no ownership filter.
 * `knownExpiresAt` is an additional legacy guard: a re-reserved row has a newer
 * `reservedAt`, so a stale tab can't free a number another buyer now holds.
 */
export async function releaseCartHolds(
  numberIds: string[],
  cartSessionId?: string | null,
  knownExpiresAt?: number,
): Promise<void> {
  if (numberIds.length === 0) return
  if (cartSessionId === null) return
  const where: Prisma.EditionNumberWhereInput = {
    id: { in: numberIds },
    state: 'reserved',
    paymentIntentId: null,
    orderItemId: null,
  }
  if (cartSessionId !== undefined) where.cartSessionId = cartSessionId
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
      cartSessionId: null,
      holdStartedAt: null,
    },
  })
}

/**
 * Refresh `reservedAt=now()` for still-held cart rows so an engaged buyer's
 * cart doesn't expire under them. Returns the new `expiresAt`. Rows that have
 * advanced to checkout (PI/order item set) are left untouched.
 *
 * `cartSessionId` scoping matches releaseCartHolds: a string scopes to the
 * owning session AND enforces the absolute-lifetime cap (a hold past its hard
 * limit is not refreshed — the sweep reclaims it); null is a cookie-less client
 * request that owns nothing; undefined is a server-trusted caller (checkout).
 */
export async function extendCartHold(
  numberIds: string[],
  cartSessionId?: string | null,
): Promise<number> {
  const expiresAt = Date.now() + CART_HOLD_TTL_MS
  if (numberIds.length === 0) return expiresAt
  if (cartSessionId === null) return expiresAt

  const where: Prisma.EditionNumberWhereInput = {
    id: { in: numberIds },
    state: 'reserved',
    paymentIntentId: null,
    orderItemId: null,
  }
  if (cartSessionId !== undefined) {
    where.cartSessionId = cartSessionId
    // Don't refresh a hold past its absolute lifetime — let the sweep reclaim
    // it. (Skipped for the server-trusted checkout path, which is about to
    // attach a PI and leave the cart-hold window entirely.)
    where.holdStartedAt = { gte: new Date(Date.now() - CART_HOLD_MAX_LIFETIME_MS) }
  }
  await prisma.editionNumber.updateMany({ where, data: { reservedAt: new Date() } })
  return expiresAt
}
