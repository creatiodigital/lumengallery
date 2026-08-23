import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import prisma from '@/lib/prisma'

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { slug },
      include: {
        // Live variants only. This is what makes a LIMITED edition buyable —
        // it carries no artwork-level price — and without it the exhibition
        // modal hid "Order Print" on every limited work.
        limitedVariants: { where: LIVE_VARIANT_WHERE, select: { id: true } },
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

    // Numbers still available across the live variants — an exhibition visitor
    // must see "Sold out" rather than a CTA into a wizard that refuses.
    const availableNumberCount =
      artwork && artwork.limitedVariants.length > 0
        ? await prisma.editionNumber.count({
            where: {
              variantId: { in: artwork.limitedVariants.map((v) => v.id) },
              state: 'available',
            },
          })
        : 0

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
            editionType: artwork.editionType,
            liveVariantCount: artwork.limitedVariants.length,
            availableNumberCount,
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
