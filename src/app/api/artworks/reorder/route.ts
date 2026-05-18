import { revalidateTag } from 'next/cache'
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

    // Verify all artworks belong to this user
    const artworks = await prisma.artwork.findMany({
      where: { id: { in: artworkIds } },
      select: { id: true, userId: true },
    })

    const allOwned = artworks.every((a) => a.userId === userId)
    if (!allOwned) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update each artwork's order based on its position in the array
    await prisma.$transaction(
      artworkIds.map((id, index) =>
        prisma.artwork.update({
          where: { id },
          data: { order: index },
        }),
      ),
    )

    // Bust the public surfaces that read Artwork.order so the artist's
    // reorder appears immediately instead of waiting for the 1h cache TTL.
    revalidateTag('artworks', 'default')
    revalidateTag('exhibitions', 'default')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering artworks:', error)
    return NextResponse.json({ error: 'Failed to reorder artworks' }, { status: 500 })
  }
}
