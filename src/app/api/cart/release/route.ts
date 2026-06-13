import { NextResponse } from 'next/server'

import { releaseCartHolds } from '@/lib/editions/reserveForCart'
import { captureError } from '@/lib/observability/captureError'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cart/release — drop CART HOLDS the client no longer needs (line
 * removed, quantity lowered, cart cleared). The underlying `releaseCartHolds`
 * is guarded so it only frees rows that are still cart holds; rows that have
 * since advanced to checkout (PI/order item attached) are left untouched.
 *
 * The client passes the `expiresAt` it holds so the release is ownership-scoped:
 * a number the TTL sweep already reclaimed and another buyer re-reserved (newer
 * reservedAt) is left alone, never freed by a stale tab.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const numberIds = body.numberIds
    const expiresAt = body.expiresAt

    if (
      !Array.isArray(numberIds) ||
      numberIds.length === 0 ||
      !numberIds.every((id) => typeof id === 'string')
    ) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    if (expiresAt !== undefined && (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt))) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    await releaseCartHolds(numberIds, expiresAt)

    return NextResponse.json({ ok: true })
  } catch (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      flow: 'order',
      stage: 'cart-release',
      level: 'error',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
