import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { slug },
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
            slug: artwork.slug,
            name: artwork.name,
            title: artwork.title,
            author: artwork.author,
            year: artwork.year,
            technique: artwork.technique,
            dimensions: artwork.dimensions,
            description: artwork.description,
            imageUrl: artwork.imageUrl,
            originalWidth: artwork.originalWidth,
            originalHeight: artwork.originalHeight,
            printEnabled: artwork.printEnabled,
            printPriceCents: artwork.printPriceCents,
          },
          artist: artwork.user,
        }
      : null

    if (!data) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[GET /api/artworks/by-slug/[slug]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
