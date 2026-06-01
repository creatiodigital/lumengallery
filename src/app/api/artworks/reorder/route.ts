import { NextResponse } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// POST reorder artworks
export async function POST(request: Request) {
  try {
    // Require authenticated user and get their ID
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = await request.json()
    const { artworkIds } = body as { artworkIds: string[] }

    if (!Array.isArray(artworkIds)) {
      return NextResponse.json({ error: 'artworkIds must be an array' }, { status: 400 })
    }

    // Persist the new order. `updateMany` scoped to { id, userId } both
    // enforces ownership per-row AND is resilient to ids that are no longer
    // in the DB (a stale client list): a missing or foreign id updates zero
    // rows instead of throwing P2025 and rolling the whole transaction back.
    // The previous code used `update`, which threw on the first stale id and
    // 500'd, so the new order was never saved.
    await prisma.$transaction(
      artworkIds.map((id, index) =>
        prisma.artwork.updateMany({
          where: { id, userId },
          data: { order: index },
        }),
      ),
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering artworks:', error)
    return NextResponse.json({ error: 'Failed to reorder artworks' }, { status: 500 })
  }
}
