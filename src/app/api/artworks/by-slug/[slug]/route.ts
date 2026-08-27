import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getArtworkMedia } from '@/lib/artwork/artworkMedia'
import { buildArtworkCommerce, COMMERCE_SELECT } from '@/lib/editions/artworkCommerce'
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
        limitedVariants: {
          where: LIVE_VARIANT_WHERE,
          select: { id: true, ...COMMERCE_SELECT.limitedVariants.select },
        },
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

    // The same resolved payload the artwork page builds, so the two surfaces
    // describe a sale identically. It also replaces what used to be sent raw:
    // `printPriceCents` is the artist's cut, and shipping it to the browser put
    // the gallery's margin one subtraction away from any visitor.
    const commerce = artwork ? await buildArtworkCommerce(artwork.id, artwork) : null

    // The modal mirrors the artwork page, so it needs the same supplementary
    // media. Empty for most works, which is the normal case.
    const media = artwork ? await getArtworkMedia(artwork.id) : []

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
            editionType: artwork.editionType,
            liveVariantCount: artwork.limitedVariants.length,
            availableNumberCount,
          },
          artist: artwork.user,
          commerce,
          media,
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
