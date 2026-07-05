import type { Metadata } from 'next'

import { PrintsPage } from '@/components/prints'
import prisma from '@/lib/prisma'
import { getPurchasesPaused } from '@/lib/settings'

import { getPrintArtistOptions, getPrintsCatalogPage } from './actions'

export const metadata: Metadata = {
  title: { absolute: 'Prints · The Art Room' },
  description:
    'Order fine-art prints of selected works from The Art Room artists, produced on museum-grade paper.',
}

// Render per request so print toggles, prices and the CMS copy show immediately.
// Safe now that <RichText> sanitizes with sanitize-html (pure JS) instead of
// isomorphic-dompurify (jsdom) — the jsdom render is what 500'd this at runtime.
// Bounded with `take` (24/page) from the start; the client takes over for
// subsequent pages and filters. No ISR / revalidate / cached RSC — by design.
export const dynamic = 'force-dynamic'

const Prints = async () => {
  // Kill switch (admin dashboard): render the same "coming soon" state the
  // page shows when zero artworks are print-enabled — catalog, filters and
  // cart all disappear without touching any per-artwork flag.
  const paused = await getPurchasesPaused()
  if (paused) {
    const pausedPageRaw = await prisma.pageContent.findUnique({ where: { slug: 'prints' } })
    return (
      <PrintsPage
        initialItems={[]}
        initialTotal={0}
        artistOptions={[]}
        pageContent={
          pausedPageRaw
            ? {
                title: pausedPageRaw.title,
                content: pausedPageRaw.content ?? '',
                bannerImageUrl: pausedPageRaw.bannerImageUrl ?? null,
              }
            : null
        }
      />
    )
  }

  // SSR the first, unfiltered page + the artist options + the CMS copy in one
  // round-trip group. The browser then drives pages/filters via the same action.
  const [{ items, totalCount }, artistOptions, pageRaw] = await Promise.all([
    getPrintsCatalogPage({ page: 1 }),
    getPrintArtistOptions(),
    prisma.pageContent.findUnique({ where: { slug: 'prints' } }),
  ])

  const pageContent = pageRaw
    ? {
        title: pageRaw.title,
        content: pageRaw.content ?? '',
        bannerImageUrl: pageRaw.bannerImageUrl ?? null,
      }
    : null

  return (
    <PrintsPage
      initialItems={items}
      initialTotal={totalCount}
      artistOptions={artistOptions}
      pageContent={pageContent}
    />
  )
}

export default Prints
