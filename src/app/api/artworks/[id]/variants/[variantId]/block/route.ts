import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * "Block variant" — ADMIN / superAdmin only. The inverse of `…/unblock`:
 * re-freezes a previously-unblocked variant (`blocked = true`) after a fix,
 * which also resumes it for sale. Edition numbers are unchanged — only the
 * lock state flips.
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
        { error: 'Only a published variant can be blocked.' },
        { status: 400 },
      )
    }

    await prisma.limitedVariant.update({ where: { id: variantId }, data: { blocked: true } })

    // A blocked, published variant is live — so the series type is frozen.
    await prisma.artwork.update({ where: { id }, data: { editionLocked: true } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/variants/[variantId]/block] error:', error)
    return NextResponse.json({ error: 'Failed to block variant.' }, { status: 500 })
  }
}
