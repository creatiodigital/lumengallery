import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireOwnership } from '@/lib/authUtils'
import { deleteLimitedVariant } from '@/lib/editions/deleteLimitedVariant'
import { parseIncomingVariants } from '@/lib/editions/parseIncomingVariants'
import { saveSingleVariant } from '@/lib/editions/saveSingleVariant'
import prisma from '@/lib/prisma'

/**
 * DELETE one limited-edition variant, immediately.
 *
 * The dashboard's "Delete variant" used to be a local edit that only reached
 * the database if the artist went on to save the whole artwork form — so a
 * delete followed by a reload came back. This is the durable path: the
 * confirm modal calls here and the row is gone when it returns.
 *
 * Auth mirrors the sibling publish route (`requireOwnership` on the parent
 * artwork) so an artist can delete their own draft variant; every business
 * rule — on sale, sold copies, last-variant — lives in `deleteLimitedVariant`
 * so it stays testable without auth.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })

    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    const result = await deleteLimitedVariant({ artworkId: id, variantId })
    if (!result.ok) {
      // 'Variant not found.' is the only 404 in here; the rest are refusals
      // about the variant's state, which are the caller's problem to show.
      const status = result.error === 'Variant not found.' ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/artworks/[id]/variants/[variantId]] error:', error)
    return NextResponse.json({ error: 'Failed to delete variant.' }, { status: 500 })
  }
}

/**
 * PATCH one variant, on its own.
 *
 * The artist should not have to scroll to the bottom of the artwork form and
 * save everything just to edit one variant — and that whole-artwork save
 * re-validates every OTHER variant's geometry, so one drifted variant could
 * block an edit to a healthy one.
 *
 * What may change is decided by `saveSingleVariant`, not here: a LIVE variant
 * (published + blocked) accepts only its name and price, because its physical
 * identity is what a buyer was promised; a draft or an admin-unblocked variant
 * accepts every field, validated exactly as the full save validates it.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })

    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    // The form tracks euros as a string; cents is what we store. Reject
    // outright rather than coercing NaN to 0 and saving a free print.
    if (!Number.isFinite(Number(body.priceEuros))) {
      return NextResponse.json({ error: 'Enter a price greater than zero.' }, { status: 400 })
    }

    // Same wire-shape coercion the full artwork save uses, so a variant means
    // the same thing whichever door it comes through. `saveSingleVariant`
    // decides what may actually change: a LIVE variant accepts only name and
    // price; anything else accepts every field, fully validated.
    const [input] = parseIncomingVariants([body])
    const result = await saveSingleVariant({ artworkId: id, variantId, input })
    if (!result.ok) {
      const status = result.error === 'Variant not found.' ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true, variantId: result.variantId })
  } catch (error) {
    console.error('[PATCH /api/artworks/[id]/variants/[variantId]] error:', error)
    return NextResponse.json({ error: 'Failed to save variant.' }, { status: 500 })
  }
}
