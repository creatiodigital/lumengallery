import { SALE_SELECT, saleFromRow, type ArtworkSale } from '@/lib/editions/artworkSale'
import prisma from '@/lib/prisma'

/**
 * The gallery's own selection — the entire contents of /prints.
 *
 * Two reads, and the difference between them is the point. The public one shows
 * only what a buyer can complete right now; the admin one shows every entry with
 * the reason any of them has gone quiet, because a selection that silently
 * shrinks is one the curator cannot maintain.
 *
 * Neither restates what "currently selling" means. That lives in
 * `resolveArtworkSale`, and this consumes it.
 */

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  title: true,
  author: true,
  year: true,
  technique: true,
  dimensions: true,
  imageUrl: true,
  ...SALE_SELECT,
} as const

export type GallerySelectionCard = {
  id: string
  slug: string
  name: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  imageUrl: string | null
  originalWidth: number | null
  originalHeight: number | null
  /** Display name of the artist, `author` winning over the account name the
   *  same way `displayArtist` resolves it elsewhere. Carried on the card so
   *  /prints can build its artist filter from the selection itself, with no
   *  second query and no artist in the list who has nothing on the page. */
  artistName: string
  sale: ArtworkSale
}

/** Why an entry is not on the page. `live` means it is. */
export type SelectionStatus = 'live' | 'sold-out' | 'not-for-sale'

export type AdminSelectionRow = {
  selectionId: string
  order: number
  status: SelectionStatus
  artwork: Omit<GallerySelectionCard, 'sale'> & { sale: ArtworkSale | null }
  artistName: string
}

const orderedRows = () =>
  prisma.selectedPrint.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      order: true,
      artwork: {
        select: {
          ...CARD_SELECT,
          user: { select: { name: true, lastName: true } },
        },
      },
    },
  })

/**
 * Return type annotated explicitly. Left inferred, `card` picks up Prisma's
 * `title: string` (the column has a DB default, not a `?`) instead of
 * `GallerySelectionCard`'s wider `string | null` — and the `c is
 * GallerySelectionCard` predicate in `getGallerySelection` below then fails to
 * compile in both directions, since neither type is assignable to the other.
 */
function toCard(row: Awaited<ReturnType<typeof orderedRows>>[number]['artwork']): {
  card: AdminSelectionRow['artwork']
  artistName: string
} {
  const { limitedVariants, printEnabled, printPriceCents, editionType, user, ...rest } = row
  const artistName =
    rest.author?.trim() || [user.name, user.lastName].filter(Boolean).join(' ').trim()
  return {
    card: {
      ...rest,
      artistName,
      sale: saleFromRow({
        editionType,
        printEnabled,
        printPriceCents,
        originalWidth: rest.originalWidth,
        originalHeight: rest.originalHeight,
        limitedVariants,
      }),
    },
    artistName,
  }
}

/** What /prints renders: selected works that are currently selling — sold-out
 *  editions included, shown and marked. */
export async function getGallerySelection(): Promise<GallerySelectionCard[]> {
  const rows = await orderedRows()
  // `sale != null`, NOT `minPriceCents != null`. A sold-out edition stays on the
  // page — ArtworkGrid renders it as "Sold out" instead of a CTA — because a page
  // where editions have gone is the signal that editions move. Only work that is
  // not for sale at all (prints off, unpriced, every variant paused) is hidden:
  // no story there, and the CTA would be a dead end.
  return rows
    .map((row) => toCard(row.artwork).card)
    .filter((c): c is GallerySelectionCard => c.sale != null)
}

/** Every entry, with the reason any of them is hidden. */
export async function getGallerySelectionForAdmin(): Promise<AdminSelectionRow[]> {
  const rows = await orderedRows()
  return rows.map((row) => {
    const { card, artistName } = toCard(row.artwork)
    const status: SelectionStatus =
      card.sale == null ? 'not-for-sale' : card.sale.minPriceCents == null ? 'sold-out' : 'live'
    return { selectionId: row.id, order: row.order, status, artwork: card, artistName }
  })
}
