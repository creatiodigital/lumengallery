import type { Metadata } from 'next'

import { ExhibitionsPage } from '@/components/exhibitions'
import prisma from '@/lib/prisma'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Exhibitions' },
  description:
    'Browse current and past virtual exhibitions at The Art Room. Experience contemporary art in immersive 3D gallery spaces.',
}

// Render per request and read straight from the DB so publish/unpublish and
// edits show immediately. No data cache.
export const dynamic = 'force-dynamic'

// Same public filter the API applies for unauthenticated visitors:
// hide unpublished + admin/superAdmin-owned exhibitions.
const getPublicExhibitions = () =>
  prisma.exhibition.findMany({
    where: {
      published: true,
      user: { userType: { notIn: ['admin', 'superAdmin'] } },
    },
    select: {
      id: true,
      mainTitle: true,
      url: true,
      status: true,
      featuredImageUrl: true,
      user: {
        select: {
          name: true,
          lastName: true,
          handler: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

const Exhibitions = async () => {
  const exhibitions = await getPublicExhibitions()
  return <ExhibitionsPage exhibitions={exhibitions} />
}

export default Exhibitions
