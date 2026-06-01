import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArtworkDetailPage } from '@/components/artwork/detail'
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

  const { user, ...artworkData } = artwork
  return <ArtworkDetailPage artwork={artworkData} artist={user} />
}

export default ArtworkPage
