import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireOwnership } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * "Ready to Sell" for a SINGLE limited-edition variant — the artist's
 * per-variant go-live action (replaces the old artwork-level publish for
 * limited editions). It materialises this variant's `EditionNumber` ledger
 * (1..editionSize as `available`), flips `published = true` (leaving the
 * default `blocked = true`, so it's frozen + on sale), and locks the parent
 * artwork's series type (`editionLocked = true`) — the one-way door that
 * stops the open/limited radio flipping while a variant is live.
 *
 * Mirrors one iteration of the legacy `publish-edition` loop. Idempotent:
 * an already-published variant is rejected (use the admin unblock/block flow
 * to edit a live one). Open editions never call this — they keep the
 * artwork-level publish.
 *
 * Returns the refreshed artwork (with variants, ordered) so the dashboard
 * can repopulate without a second round-trip.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      select: { userId: true, editionType: true },
    })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })

    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    if (artwork.editionType !== 'limited') {
      return NextResponse.json(
        { error: 'Only limited editions publish per variant.' },
        { status: 400 },
      )
    }

    const variant = await prisma.limitedVariant.findUnique({
      where: { id: variantId },
      select: { id: true, artworkId: true, published: true, editionSize: true },
    })
    if (!variant || variant.artworkId !== id) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }
    if (variant.published) {
      return NextResponse.json({ error: 'This variant is already on sale.' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Pre-materialise every number 1..editionSize as `available`.
      // createMany + the @@unique([variantId, number]) makes this the
      // atomic backbone of the oversell gate.
      await tx.editionNumber.createMany({
        data: Array.from({ length: variant.editionSize }, (_, i) => ({
          variantId: variant.id,
          number: i + 1,
        })),
        skipDuplicates: true,
      })
      await tx.limitedVariant.update({ where: { id: variant.id }, data: { published: true } })
      // First live variant locks the series type. Already-true is harmless.
      await tx.artwork.update({ where: { id }, data: { editionLocked: true } })
    })

    const updated = await prisma.artwork.findUnique({
      where: { id },
      include: { limitedVariants: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ ok: true, artwork: updated })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/variants/[variantId]/publish] error:', error)
    return NextResponse.json({ error: 'Failed to publish variant.' }, { status: 500 })
  }
}
