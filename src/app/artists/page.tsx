import type { Metadata } from 'next'

import { ArtistsPage } from '@/components/artists'
import prisma from '@/lib/prisma'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Artists' },
  description:
    'Discover the artists exhibiting at The Art Room. Explore their profiles, biographies, and virtual exhibitions.',
}

// Render per request and read straight from the DB so new/edited artists
// appear immediately. No data cache.
export const dynamic = 'force-dynamic'

const getArtistsList = () =>
  prisma.user.findMany({
    where: { userType: 'artist', published: true },
    select: {
      id: true,
      name: true,
      lastName: true,
      handler: true,
      biography: true,
      profileImageUrl: true,
    },
    orderBy: { name: 'asc' },
  })

const Artists = async () => {
  const artists = await getArtistsList()
  return <ArtistsPage artists={artists} />
}

export default Artists
