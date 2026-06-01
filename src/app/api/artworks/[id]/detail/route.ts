import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

// GET artwork detail with artist info
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            handler: true,
          },
        },
      },
    })

    const data = artwork
      ? {
          artwork: {
            id: artwork.id,
            name: artwork.name,
            title: artwork.title,
            author: artwork.author,
            year: artwork.year,
            technique: artwork.technique,
            dimensions: artwork.dimensions,
            description: artwork.description,
            imageUrl: artwork.imageUrl,
          },
          artist: artwork.user,
        }
      : null

    if (!data) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[GET /api/artworks/[id]/detail] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
