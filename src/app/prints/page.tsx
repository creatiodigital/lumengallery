import type { Metadata } from 'next'

import { PrintsPage } from '@/components/prints'
import prisma from '@/lib/prisma'

export const metadata: Metadata = {
  title: { absolute: 'Prints · The Art Room' },
  description:
    'Order fine-art prints of selected works from The Art Room artists, produced on museum-grade paper.',
}

// Render per request and read straight from the DB so print toggles, prices
// and CMS copy edits appear immediately. Renders <RichText> server-side, same
// as the now-dynamic content pages — verified safe on staging. No cache.
export const dynamic = 'force-dynamic'

const getPrintsPage = async () => {
  const [artworksRaw, page] = await Promise.all([
    prisma.artwork.findMany({
      where: {
        printEnabled: true,
        printPriceCents: { not: null },
        user: { published: true },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        name: true,
        author: true,
        year: true,
        imageUrl: true,
        originalWidth: true,
        originalHeight: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            handler: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pageContent.findUnique({ where: { slug: 'prints' } }),
  ])
  // PrintsPage expects createdAt as an ISO string, so normalize here.
  const artworks = artworksRaw.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }))
  return { artworks, page }
}

const Prints = async () => {
  const { artworks, page: pageRaw } = await getPrintsPage()

  const pageContent = pageRaw
    ? {
        title: pageRaw.title,
        content: pageRaw.content ?? '',
        bannerImageUrl: pageRaw.bannerImageUrl ?? null,
      }
    : null

  return <PrintsPage artworks={artworks} pageContent={pageContent} />
}

export default Prints
