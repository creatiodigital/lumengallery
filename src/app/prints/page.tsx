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
  // SSR the first, unfiltered page + the artist options + the CMS copy + the
  // kill switch in one round-trip group. The browser then drives pages and
  // filters via the same action.
  const [paused, { items, totalCount }, artistOptions, pageRaw] = await Promise.all([
    getPurchasesPaused(),
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

  // Kill switch (admin dashboard): zero items renders the same "coming soon"
  // state the page shows when no artwork is print-enabled — catalog, filters
  // and cart all disappear without touching any per-artwork flag.
  return (
    <PrintsPage
      initialItems={paused ? [] : items}
      initialTotal={paused ? 0 : totalCount}
      artistOptions={paused ? [] : artistOptions}
      pageContent={pageContent}
    />
  )
}

export default Prints
