'use server'

import type { Prisma } from '@/generated/prisma'
import {
  PRINTS_PAGE_SIZE,
  type EditionFilter,
  type PrintArtistOption,
  type PrintArtwork,
} from '@/components/prints/types'
import { SALE_SELECT, saleFromRow } from '@/lib/editions/artworkSale'
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
  imageUrl: true,
  createdAt: true,
  // Everything needed to price the card, shared with the artist and exhibition
  // grids so all three answer "is this for sale, and at what?" with the same
  // rule. Live (not merely in-stock) variants, each carrying a probe for a
  // remaining copy — that is what lets `resolveArtworkSale` tell a sold-out
  // edition from one that was never on sale.
  ...SALE_SELECT,
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
// price set, narrowed by the optional artist + edition filters, plus a title
// search and an exclude list for the admin picker. Edition is re-validated
// here ('open' | 'limited' only) so a bad client value can't widen or break
// the query.
/**
 * Who appears in the prints catalog: exactly what a buyer can purchase. The
 * open/limited fork lives in `purchasableArtworkWhere` so the catalog, the
 * wizard, checkout, payment and the public API can't drift apart again.
 *
 * `purchasableArtworkWhere()` already returns an `OR` (the open/limited fork).
 * The search predicate below is also an `OR` (title or name) — spreading a
 * second `OR` into the same object would silently overwrite the first,
 * widening the query to unsellable work. Wrapping both in `AND` is what keeps
 * both in force at once.
 */
const buildPrintsWhere = (
  artistId: string,
  edition: EditionFilter,
  search = '',
  excludeIds: string[] = [],
): Prisma.ArtworkWhereInput => ({
  AND: [
    purchasableArtworkWhere(),
    ...(search
      ? [
          {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        ]
      : []),
  ],
  user: { published: true },
  ...(artistId ? { userId: artistId } : {}),
  ...(edition === 'open' || edition === 'limited' ? { editionType: edition } : {}),
  ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
})

type GetPrintsCatalogPageArgs = {
  page?: number
  artistId?: string
  edition?: EditionFilter
  /** Case-insensitive match on artwork title or internal name. */
  search?: string
  /** Already-selected artworks, excluded so the picker never offers a duplicate. */
  excludeIds?: string[]
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
  search = '',
  excludeIds = [],
}: GetPrintsCatalogPageArgs): Promise<{ items: PrintArtwork[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const where = buildPrintsWhere(artistId, edition, search, excludeIds)

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

  // The client expects createdAt as a serializable ISO string. The pricing
  // inputs (printPriceCents, the live variants) are stripped here — the card
  // only needs the resolved sale, and the artist's cut is not public.
  const items = rows.map((row) => {
    const { printEnabled, printPriceCents, limitedVariants, ...rest } = row
    const sale = saleFromRow({
      editionType: rest.editionType,
      originalWidth: rest.originalWidth,
      originalHeight: rest.originalHeight,
      printEnabled,
      printPriceCents,
      limitedVariants,
    })
    return {
      ...rest,
      createdAt: row.createdAt.toISOString(),
      sale,
      // Derived from `sale`, never computed separately — the two cannot drift.
      // Retained because it is the figure, and the catalog specs assert on it.
      minPriceCents: sale?.minPriceCents ?? null,
    }
  })
  return { items, totalCount }
}

/**
 * Distinct artists who have ≥1 print-enabled, published artwork, with how many —
 * the source for the admin picker's artist list ('All artists' is prepended
 * client-side as a UI concern). Fetched once on the server because the client
 * only holds one page and can no longer derive the list from the loaded array.
 * Scales with the number of artists, not artworks, so it stays small.
 *
 * Grouped by the account that owns the work (`userId`), not by the per-work
 * `author` override the grid otherwise displays: the picker groups by artist,
 * and an overridden work would otherwise split one artist into two rows.
 */
export async function getPrintArtistOptions(): Promise<PrintArtistOption[]> {
  const grouped = await prisma.artwork.groupBy({
    by: ['userId'],
    where: buildPrintsWhere('', ''),
    _count: { _all: true },
  })
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, name: true, lastName: true },
  })
  return grouped
    .map((g) => {
      const u = users.find((x) => x.id === g.userId)
      const label = [u?.name, u?.lastName].filter(Boolean).join(' ').trim()
      return { value: g.userId, label, count: g._count._all }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}
