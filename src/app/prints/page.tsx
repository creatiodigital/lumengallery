import { unstable_cache } from 'next/cache'
import type { Metadata } from 'next'

import { PrintsPage } from '@/components/prints'
import prisma from '@/lib/prisma'

export const metadata: Metadata = {
  title: { absolute: 'Prints · The Art Room' },
  description:
    'Order fine-art prints of selected works from The Art Room artists, produced on museum-grade paper.',
}

// Tags match existing API tags so write-path revalidations cover this
// surface too: 'page-prints' (CMS edit), 'artworks' (artwork edit).
const getCachedPrintsPage = unstable_cache(
  async () => {
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
    // Convert Date → ISO string before the cache stores the payload.
    // unstable_cache serializes on store; reading a cached entry gives
    // back a string, so calling .toISOString() outside this function
    // crashes on cache hits.
    const artworks = artworksRaw.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    }))
    return { artworks, page }
  },
  ['prints-public-page'],
  { tags: ['page-prints', 'artworks'], revalidate: 3600 },
)

const Prints = async () => {
  const { artworks, page: pageRaw } = await getCachedPrintsPage()

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
