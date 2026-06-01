import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ExhibitionProfilePage } from '@/components/exhibitions/profile'
import { getPublicExhibitionByUrl } from '@/lib/queries/getPublicExhibitionByUrl'
import prisma from '@/lib/prisma'

// Render per request and read straight from the DB so artwork reordering and
// metadata edits show immediately (the 3D scene itself still comes from the
// published snapshot). No data cache.
export const dynamic = 'force-dynamic'

interface ExhibitionProfileProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
}

export async function generateMetadata({ params }: ExhibitionProfileProps): Promise<Metadata> {
  const { artistSlug, exhibitionSlug } = await params

  const exhibition = await prisma.exhibition.findFirst({
    where: {
      url: exhibitionSlug,
      user: { handler: artistSlug },
      published: true,
    },
    select: {
      mainTitle: true,
      shortDescription: true,
      featuredImageUrl: true,
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!exhibition) {
    return { title: 'Exhibition Not Found' }
  }

  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`
  const tabTitle = `${artistName} | ${exhibition.mainTitle} | The Art Room`
  const description =
    exhibition.shortDescription ||
    `Explore "${exhibition.mainTitle}" by ${artistName} at The Art Room.`

  return {
    title: { absolute: tabTitle },
    description,
    openGraph: {
      title: tabTitle,
      description,
      ...(exhibition.featuredImageUrl && {
        images: [{ url: exhibition.featuredImageUrl, width: 1200, height: 630, alt: tabTitle }],
      }),
    },
  }
}

const ExhibitionProfile = async ({ params }: ExhibitionProfileProps) => {
  const { artistSlug, exhibitionSlug } = await params

  const exhibition = await getPublicExhibitionByUrl(exhibitionSlug)
  if (!exhibition || exhibition.user.handler !== artistSlug) notFound()

  return (
    <ExhibitionProfilePage
      artistSlug={artistSlug}
      exhibitionSlug={exhibitionSlug}
      exhibition={exhibition}
    />
  )
}

export default ExhibitionProfile
