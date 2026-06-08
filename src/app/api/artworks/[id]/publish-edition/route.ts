import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireOwnership } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * "Start selling" — the artist's confirmation that an artwork is good to
 * be sold. The one-way door slamming shut: it LOCKS the artwork's edition
 * config (`editionLocked = true`) so the edition type can no longer be
 * changed (only an admin can unblock). For a LIMITED edition it also
 * publishes the draft variants, materialising the `EditionNumber` ledger
 * rows (1..editionSize per variant).
 *
 * Idempotent — already-published variants are skipped, so re-running after
 * adding a new optional variant only materialises the new one.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      select: {
        userId: true,
        editionType: true,
        limitedVariants: {
          where: { published: false },
          select: { id: true, editionSize: true },
        },
      },
    })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })

    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    // Open editions: just lock the config. Nothing to publish.
    if (artwork.editionType !== 'limited') {
      await prisma.artwork.update({ where: { id }, data: { editionLocked: true } })
      return NextResponse.json({ ok: true, published: 0 })
    }

    if (artwork.limitedVariants.length === 0) {
      // Nothing left to publish (already published or none) — still lock.
      await prisma.artwork.update({ where: { id }, data: { editionLocked: true } })
      return NextResponse.json({ ok: true, published: 0 })
    }

    await prisma.$transaction(async (tx) => {
      for (const variant of artwork.limitedVariants) {
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
      }
      await tx.artwork.update({ where: { id }, data: { editionLocked: true } })
    })

    return NextResponse.json({ ok: true, published: artwork.limitedVariants.length })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/publish-edition] error:', error)
    return NextResponse.json({ error: 'Failed to start selling.' }, { status: 500 })
  }
}
