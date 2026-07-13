import { NextResponse } from 'next/server'

import { extendCartHold } from '@/lib/editions/reserveForCart'
import { getCartSessionId } from '@/lib/cart/cartSession'
import { captureError } from '@/lib/observability/captureError'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cart/extend — refresh the TTL on still-held cart rows so an
 * engaged buyer's cart doesn't expire under them. Returns a fresh
 * server-owned `expiresAt` the countdown re-syncs to. Rows that have advanced
 * to checkout are left untouched by the guarded update.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const numberIds = body.numberIds

    if (
      !Array.isArray(numberIds) ||
      numberIds.length === 0 ||
      !numberIds.every((id) => typeof id === 'string')
    ) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Scope to the caller's cart session so one browser can't refresh another's
    // holds. A missing cookie (null) owns nothing → no-op.
    const cartSessionId = await getCartSessionId()
    const expiresAt = await extendCartHold(numberIds, cartSessionId)

    return NextResponse.json({ ok: true, expiresAt })
  } catch (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      flow: 'order',
      stage: 'cart-extend',
      level: 'error',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
