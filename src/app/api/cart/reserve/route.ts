import { NextResponse } from 'next/server'

import { reserveForCart } from '@/lib/editions/reserveForCart'
import { getOrCreateCartSessionId } from '@/lib/cart/cartSession'
import { getClientIp } from '@/lib/getClientIp'
import { rateLimit } from '@/lib/rateLimit'
import { captureError } from '@/lib/observability/captureError'

export const dynamic = 'force-dynamic'

// A cart add may claim at most this many edition numbers at once. Keeps a
// single request from sweeping a whole small edition into one hold.
const MAX_QUANTITY = 20

/**
 * POST /api/cart/reserve — place a CART HOLD on `quantity` limited-edition
 * numbers for a variant. On success the server returns the claimed
 * `numberIds` and a server-owned `expiresAt`; the client mirrors these in
 * localStorage but the DB rows are the authority.
 *
 * A sold-out / insufficient-stock outcome is a normal result, not an HTTP
 * error: it returns 200 `{ ok: false, reason, available }` so the client can
 * render "only N left" without treating it as a failure. Only an unexpected
 * server fault returns 500.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const variantId = body.variantId
    const quantity = body.quantity

    if (typeof variantId !== 'string' || variantId.length === 0) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Bind this hold to a per-browser cart session (httpOnly cookie) and rate
    // limit reservations per IP and per session — an unauthenticated attacker
    // must not be able to sweep a whole edition into indefinite holds.
    const cartSessionId = await getOrCreateCartSessionId()
    const ip = getClientIp(request)
    const [ipGate, sessionGate] = await Promise.all([
      rateLimit({ name: 'cart-reserve-ip', key: ip, limit: 60, windowSeconds: 60 }),
      rateLimit({ name: 'cart-reserve-session', key: cartSessionId, limit: 30, windowSeconds: 60 }),
    ])
    if (!ipGate.success || !sessionGate.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a moment.' },
        { status: 429 },
      )
    }

    const result = await reserveForCart({ variantId, quantity, cartSessionId })

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        numberIds: result.numberIds,
        reserved: result.reserved,
        expiresAt: result.expiresAt,
      })
    }

    return NextResponse.json({
      ok: false,
      reason: result.reason,
      available: result.available,
    })
  } catch (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      flow: 'order',
      stage: 'cart-reserve',
      level: 'error',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
