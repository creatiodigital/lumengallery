import { NextResponse } from 'next/server'

import { purchasableArtworkWhere } from '@/lib/editions/printable'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const artworks = await prisma.artwork.findMany({
      where: {
        // Same purchasability rule as the catalog and checkout — a limited
        // edition has no artwork-level price, so gating on it hid them all.
        ...purchasableArtworkWhere(),
        user: { published: true },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        name: true,
        author: true,
        year: true,
        imageUrl: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            handler: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(artworks)
  } catch (error) {
    console.error('[GET /api/prints] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
