import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * "Unblock artwork" — ADMIN / superAdmin only. Reverses the "Start
 * selling" lock so the artist can change the edition config again
 * (`editionLocked = false`). Artists never see or call this; it's the
 * deliberate override for the otherwise one-way go-live lock.
 *
 * Note: this does NOT un-publish variants or delete already-materialised
 * edition numbers — it only re-opens the config for editing. An admin
 * changing a limited edition that has sold copies must reconcile the
 * ledger by hand.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const { error: authError } = await requireAdminOrAbove()
    if (authError) return authError

    const artwork = await prisma.artwork.findUnique({ where: { id }, select: { id: true } })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })

    await prisma.artwork.update({ where: { id }, data: { editionLocked: false } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/unblock-edition] error:', error)
    return NextResponse.json({ error: 'Failed to unblock artwork.' }, { status: 500 })
  }
}
