import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArtworkDetailPage } from '@/components/artwork/detail'
import { getArtworkMedia } from '@/lib/artwork/artworkMedia'
import { buildArtworkCommerce, COMMERCE_SELECT } from '@/lib/editions/artworkCommerce'
import { LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import prisma from '@/lib/prisma'

// Render per request and read straight from the DB so artwork edits appear
// immediately. No data cache.
export const dynamic = 'force-dynamic'

const getArtwork = (slug: string) =>
  prisma.artwork.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      title: true,
      author: true,
      year: true,
      technique: true,
      dimensions: true,
      description: true,
      imageUrl: true,
      originalWidth: true,
      originalHeight: true,
      printEnabled: true,
      printPriceCents: true,
      editionType: true,
      // Live variants only — a published-but-unblocked variant is paused from
      // sale and would refuse the reservation. Selected rather than counted so
      // the shape is the same one LIVE_VARIANT_WHERE guards everywhere else.
      // SALE_SELECT's own sub-select carries what `saleFromRow` needs to cost
      // the cheapest purchasable configuration; `id` rides along for the
      // remaining-numbers count below.
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

interface ArtworkPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { slug } = await params

  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      imageUrl: true,
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!artwork) {
    return { title: 'Artwork Not Found' }
  }

  const artistName = `${artwork.user.name} ${artwork.user.lastName}`
  const tabTitle = `${artistName} | ${artwork.title}`
  const description = artwork.description?.slice(0, 160) || `"${artwork.title}" by ${artistName}.`

  return {
    title: { absolute: tabTitle },
    description,
    openGraph: {
      title: tabTitle,
      description,
      ...(artwork.imageUrl && {
        images: [{ url: artwork.imageUrl, alt: tabTitle }],
      }),
    },
  }
}

const ArtworkPage = async ({ params }: ArtworkPageProps) => {
  const { slug } = await params

  const artwork = await getArtwork(slug)
  if (!artwork) notFound()

  // `printPriceCents` is pulled out rather than spread onward: it is the
  // ARTIST's cut, the pricing INPUT, and the gallery's margin is one
  // subtraction away from it. The server needs it to cost the sale; the browser
  // must never see it.
  const { user, limitedVariants, printPriceCents, ...artworkData } = artwork

  // The same resolved payload the exhibition modal receives, so the two
  // surfaces describe a sale identically.
  const commerce = await buildArtworkCommerce(artwork.id, {
    ...artworkData,
    printPriceCents,
    limitedVariants,
  })

  const media = await getArtworkMedia(artwork.id)

  // How many numbers are left across the live variants. Live variants can all
  // exist while every copy is gone — that is sold out, not unpurchasable, and
  // the page says so rather than offering a button the wizard would refuse.
  const availableNumberCount =
    limitedVariants.length > 0
      ? await prisma.editionNumber.count({
          where: { variantId: { in: limitedVariants.map((v) => v.id) }, state: 'available' },
        })
      : 0

  return (
    <ArtworkDetailPage
      artwork={{ ...artworkData, liveVariantCount: limitedVariants.length, availableNumberCount }}
      artist={user}
      media={media}
      commerce={commerce}
    />
  )
}

export default ArtworkPage
