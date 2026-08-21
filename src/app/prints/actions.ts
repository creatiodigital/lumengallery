'use server'

import type { Prisma } from '@/generated/prisma'
import {
  PRINTS_PAGE_SIZE,
  type EditionFilter,
  type PrintArtistOption,
  type PrintArtwork,
} from '@/components/prints/types'
import { purchasableArtworkWhere } from '@/lib/editions/printable'
import prisma from '@/lib/prisma'
import { getPurchasesPaused } from '@/lib/settings'

/**
 * Public read of the purchases kill switch — client purchase surfaces
 * (Order Print CTAs) call this to hide themselves when the admin pauses
 * sales. Not sensitive, so no auth. Fail open (false): if the read breaks
 * we prefer a visible button (the wizard + payment actions still enforce
 * the pause server-side) over hiding commerce because of a blip.
 */
export async function getPublicPurchasesPaused(): Promise<boolean> {
  try {
    return await getPurchasesPaused()
  } catch {
    return false
  }
}

// Fields the prints grid renders. Kept in one place so the SSR'd first page and
// every client fetch return the same `PrintArtwork` shape.
const PRINT_SELECT = {
  id: true,
  slug: true,
  title: true,
  name: true,
  author: true,
  year: true,
  technique: true,
  dimensions: true,
  editionType: true,
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
} satisfies Prisma.ArtworkSelect

// The hot catalog predicate: a published artist's print-enabled work with a
// price set, narrowed by the optional artist + edition filters. Edition is
// re-validated here ('open' | 'limited' only) so a bad client value can't widen
// or break the query.
/**
 * Who appears in the prints catalog: exactly what a buyer can purchase. The
 * open/limited fork lives in `purchasableArtworkWhere` so the catalog, the
 * wizard, checkout, payment and the public API can't drift apart again.
 */
const buildPrintsWhere = (artistId: string, edition: EditionFilter): Prisma.ArtworkWhereInput => ({
  ...purchasableArtworkWhere(),
  user: { published: true },
  ...(artistId ? { userId: artistId } : {}),
  ...(edition === 'open' || edition === 'limited' ? { editionType: edition } : {}),
})

type GetPrintsCatalogPageArgs = {
  page?: number
  artistId?: string
  edition?: EditionFilter
}

/**
 * One numbered page of the prints catalog. Dynamic + uncached (server actions
 * are by default — no `unstable_cache`, no tags, no ISR, by design): a plain
 * Prisma round-trip. Returns the page's items plus the total matching count so
 * the client can compute how many pages exist.
 *
 * Offset (skip/take) is correct here: numbered pages need a total count and the
 * ability to jump to page N, which cursor pagination can't express. Offset is
 * fine at this scale.
 */
export async function getPrintsCatalogPage({
  page = 1,
  artistId = '',
  edition = '',
}: GetPrintsCatalogPageArgs): Promise<{ items: PrintArtwork[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const where = buildPrintsWhere(artistId, edition)

  const [rows, totalCount] = await Promise.all([
    prisma.artwork.findMany({
      where,
      select: PRINT_SELECT,
      // Stable ordering: newest first, id as a deterministic tiebreaker so a
      // shared createdAt never lets a row drift between pages.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (safePage - 1) * PRINTS_PAGE_SIZE,
      take: PRINTS_PAGE_SIZE,
    }),
    prisma.artwork.count({ where }),
  ])

  // The client expects createdAt as a serializable ISO string.
  const items = rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
  return { items, totalCount }
}

/**
 * Distinct artists who have ≥1 print-enabled, published artwork — the source for
 * the artist filter dropdown. Fetched once on the server because the client only
 * holds one page and can no longer derive the list from the loaded array. Scales
 * with the number of artists, not artworks, so it stays small. Label mirrors the
 * grid's artist display: the per-work `author` override if set, else the user's
 * name. ('All artists' is prepended client-side as a UI concern.)
 */
export async function getPrintArtistOptions(): Promise<PrintArtistOption[]> {
  const rows = await prisma.artwork.findMany({
    where: buildPrintsWhere('', ''),
    distinct: ['userId'],
    select: {
      userId: true,
      author: true,
      user: { select: { name: true, lastName: true } },
    },
    // Lead with userId so `distinct` is deterministic; newest work per artist
    // chosen as the representative for the (rarely-set) author override.
    orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
  })

  return rows
    .map((row) => {
      const label =
        row.author?.trim() || [row.user.name, row.user.lastName].filter(Boolean).join(' ').trim()
      return { value: row.userId, label }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}
