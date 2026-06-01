import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArtistProfilePage } from '@/components/artists/profile'
import prisma from '@/lib/prisma'

// Render per request and read straight from the DB so artist edits, new
// exhibitions and featured-artwork changes appear immediately. No data cache.
export const dynamic = 'force-dynamic'

const getArtistFull = (slug: string) =>
  prisma.user.findFirst({
    where: { handler: slug, published: true },
    select: {
      id: true,
      name: true,
      lastName: true,
      handler: true,
      biography: true,
      profileImageUrl: true,
      exhibitions: {
        where: { published: true },
        select: {
          id: true,
          mainTitle: true,
          url: true,
          handler: true,
          featuredImageUrl: true,
          shortDescription: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      artworks: {
        where: { artworkType: 'image', featured: true },
        select: {
          id: true,
          slug: true,
          name: true,
          title: true,
          author: true,
          year: true,
          technique: true,
          dimensions: true,
          imageUrl: true,
          originalWidth: true,
          originalHeight: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  })

interface ArtistProfileProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArtistProfileProps): Promise<Metadata> {
  const { slug } = await params

  const artist = await prisma.user.findFirst({
    where: { handler: slug, published: true },
    select: { name: true, lastName: true, biography: true, profileImageUrl: true },
  })

  if (!artist) {
    return { title: 'Artist Not Found' }
  }

  const artistName = `${artist.name} ${artist.lastName}`
  const description =
    artist.biography?.slice(0, 160) || `Explore exhibitions by ${artistName} at The Art Room.`

  const tabTitle = `${artistName} | The Art Room`

  return {
    title: { absolute: tabTitle },
    description,
    openGraph: {
      title: tabTitle,
      description,
      ...(artist.profileImageUrl && {
        images: [{ url: artist.profileImageUrl, alt: artistName }],
      }),
    },
  }
}

const ArtistProfile = async ({ params }: ArtistProfileProps) => {
  const { slug } = await params

  // One round-trip instead of three: artist + their published exhibitions
  // + their featured image-type artworks. The previous /api/artists,
  // /api/exhibitions, /api/artworks waterfall is collapsed here.
  const artist = await getArtistFull(slug)

  if (!artist) notFound()

  const { exhibitions, artworks, ...artistData } = artist
  return <ArtistProfilePage artist={artistData} exhibitions={exhibitions} artworks={artworks} />
}

export default ArtistProfile
