import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * "Unblock variant" — ADMIN / superAdmin only.
 *
 * Reopens a single PUBLISHED variant for editing (`blocked = false`) so a
 * mistake can be corrected, and simultaneously PAUSES it from sale — buyer
 * queries only surface `published && blocked`, and reservations are refused
 * while unblocked. Already-sold/reserved edition numbers are untouched.
 * Re-freeze with the sibling `…/block` route when done.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await context.params

    const { error: authError } = await requireAdminOrAbove()
    if (authError) return authError

    const variant = await prisma.limitedVariant.findUnique({
      where: { id: variantId },
      select: { id: true, artworkId: true, published: true },
    })
    if (!variant || variant.artworkId !== id) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }
    if (!variant.published) {
      return NextResponse.json(
        { error: 'Only a published variant can be unblocked.' },
        { status: 400 },
      )
    }

    await prisma.limitedVariant.update({ where: { id: variantId }, data: { blocked: false } })

    // Keep the series-type lock honest: the open/limited radio is frozen only
    // while at least one variant is live (published + blocked). Unblocking the
    // last blocked variant re-opens it.
    const stillLive = await prisma.limitedVariant.count({
      where: { artworkId: id, published: true, blocked: true },
    })
    await prisma.artwork.update({
      where: { id },
      data: { editionLocked: stillLive > 0 },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/variants/[variantId]/unblock] error:', error)
    return NextResponse.json({ error: 'Failed to unblock variant.' }, { status: 500 })
  }
}
