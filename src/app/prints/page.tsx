import type { Metadata } from 'next'

import { PrintsPage } from '@/components/prints'
import { getGallerySelection } from '@/lib/queries/getGallerySelection'
import prisma from '@/lib/prisma'
import { getPurchasesPaused } from '@/lib/settings'

export const metadata: Metadata = {
  title: { absolute: 'Prints · The Art Room' },
  description:
    'Order fine-art prints of selected works from The Art Room artists, produced on museum-grade paper.',
}

// Render per request so a change to the selection, a price, or the CMS copy
// shows immediately. No ISR / revalidate — by design.
export const dynamic = 'force-dynamic'

const Prints = async () => {
  const [paused, selection, pageRaw] = await Promise.all([
    getPurchasesPaused(),
    getGallerySelection(),
    prisma.pageContent.findUnique({ where: { slug: 'prints' } }),
  ])

  const pageContent = pageRaw
    ? {
        title: pageRaw.title,
        content: pageRaw.content ?? '',
        bannerImageUrl: pageRaw.bannerImageUrl ?? null,
      }
    : null

  // Kill switch: an empty selection renders the same quiet state as a selection
  // nobody can buy from, so pausing sales needs no per-artwork flag.
  return <PrintsPage selection={paused ? [] : selection} pageContent={pageContent} />
}

export default Prints
