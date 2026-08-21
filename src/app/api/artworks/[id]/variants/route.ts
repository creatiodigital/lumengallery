import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isAdminOrAbove, requireOwnership } from '@/lib/authUtils'
import { parseIncomingVariants } from '@/lib/editions/parseIncomingVariants'
import { saveSingleVariant } from '@/lib/editions/saveSingleVariant'
import prisma from '@/lib/prisma'

/**
 * CREATE one limited-edition variant, on its own.
 *
 * The counterpart to PATCH on `[variantId]`: a variant the artist has just
 * added should be savable from its own card, without saving the whole artwork
 * — which also means a brand-new variant can't be blocked by an unrelated
 * variant whose geometry has drifted.
 *
 * Creates a DRAFT (`published: false`). No edition numbers are materialised;
 * that still happens at "Ready to Sell". If the artwork is still typed 'open',
 * creating a variant switches it to 'limited' in the same transaction — adding
 * a variant is what declaring a limited edition MEANS, and requiring an artwork
 * save first would defeat the point of saving a variant on its own.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })

    const { error: authError, session } = await requireOwnership(artwork.userId)
    if (authError) return authError

    // NOTE: no editionType gate here. Adding a variant is how an artist DECLARES
    // an artwork a limited edition, and the dashboard lets them pick "Limited
    // Edition" and add a variant without saving the artwork first — refusing
    // because the page hasn't been saved is the exact friction this endpoint
    // exists to remove. `saveSingleVariant` flips the type as part of the create,
    // in one transaction, under the same lock rule the artwork PUT enforces.

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    // Reuse the wire-shape coercion the full artwork save uses, so a variant
    // means exactly the same thing whichever door it comes through.
    const [input] = parseIncomingVariants([body])
    const result = await saveSingleVariant({
      artworkId: id,
      input,
      requesterIsAdmin: isAdminOrAbove(session?.user?.userType),
    })
    if (!result.ok) {
      // The locked-artwork refusal is a conflict, not bad input.
      const status = result.error.includes('locked for sale') ? 409 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true, variantId: result.variantId })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/variants] error:', error)
    return NextResponse.json({ error: 'Failed to create variant.' }, { status: 500 })
  }
}
