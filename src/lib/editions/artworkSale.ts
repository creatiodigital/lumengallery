/**
 * What a single artwork CARD should say about buying a print — the one answer
 * every grid asks for, rather than each page deciding for itself.
 *
 * `/prints` never needed this: `buildPrintsWhere` had already narrowed the list
 * to purchasable work, so every card was for sale and a missing price could
 * only mean sold out. That let the grid take a single `withOrderPrint` flag for
 * the whole page.
 *
 * The artist and exhibition grids hold everything an artist made — sellable and
 * not — so the flag has to become per-card data, and the two "no price" cases
 * stop being interchangeable:
 *
 *   null                    not for sale. The card shows no commerce at all.
 *   { minPriceCents: n }    on sale at n.
 *   { minPriceCents: null } live, but nothing left to buy → "Sold out".
 *
 * Collapsing those last two is the failure this file exists to prevent: reuse
 * `/prints`' "null price means sold out" shortcut on a mixed grid and every
 * work the artist never put up for sale gets stamped "Sold out".
 *
 * The purchasability rule itself is NOT restated here — it comes from
 * `isArtworkPurchasable`, and the figures from `minimumPrice`. This only picks
 * between the three outcomes.
 */
import type { Prisma } from '@/generated/prisma'

import { minimumPriceForLimited, minimumPriceForOpen, type LiveVariant } from './minimumPrice'
import { isArtworkPurchasable, LIVE_VARIANT_WHERE } from './printable'

export type ArtworkSale = {
  editionType: 'open' | 'limited'
  /** Cheapest completable purchase in cents, excluding shipping and tax.
   *  `null` means live but sold out — never "not for sale", which is the
   *  absence of the whole `ArtworkSale`. */
  minPriceCents: number | null
  /** Which LIMITED variant produced `minPriceCents`. Surfaced so a caller can
   *  describe the same configuration the figure was costed from — pairing the
   *  cheapest price with some other variant's edition would let the two
   *  describe different objects. `null` for open editions and when sold out. */
  variantName?: string | null
}

/**
 * A live variant (published + blocked + priced) plus whether it still has a
 * copy. Loading it this way answers both questions in one sub-select: how many
 * variants are live decides whether the work is on sale at all, and which of
 * them still have numbers decides the price. Filtering the query down to
 * in-stock variants alone would make a sold-out edition indistinguishable from
 * one that was never for sale.
 */
export type SaleVariant = LiveVariant & { hasAvailableNumber: boolean }

export type SaleArtwork = {
  editionType: string
  printEnabled: boolean
  printPriceCents: number | null
  originalWidth: number | null
  originalHeight: number | null
}

export function resolveArtworkSale(
  artwork: SaleArtwork,
  liveVariants: SaleVariant[] = [],
): ArtworkSale | null {
  const purchasable = isArtworkPurchasable({
    printEnabled: artwork.printEnabled,
    editionType: artwork.editionType,
    printPriceCents: artwork.printPriceCents,
    liveVariantCount: liveVariants.length,
  })
  if (!purchasable) return null

  if (artwork.editionType === 'limited') {
    const inStock = liveVariants.filter((v) => v.hasAvailableNumber)
    // Live variants, no copies left. The edition is real, it sold, and the card
    // says so — an "Order Print" button here walks the buyer into a wizard that
    // refuses them.
    if (inStock.length === 0)
      return { editionType: 'limited', minPriceCents: null, variantName: null }

    const cheapest = minimumPriceForLimited(inStock)
    // In-stock but unquotable (no variant carries a price). Not sold out —
    // saying so would invent a history — so show nothing.
    return cheapest
      ? {
          editionType: 'limited',
          minPriceCents: cheapest.cents,
          variantName: cheapest.basis === 'variant' ? cheapest.variantName : null,
        }
      : null
  }

  // Open editions are printed on demand and never sell out, so an unquotable
  // one — no pixel dimensions, so no printable size — shows nothing rather than
  // falling through to the sold-out badge.
  const smallest = minimumPriceForOpen(artwork)
  return smallest ? { editionType: 'open', minPriceCents: smallest.cents } : null
}

/**
 * The Prisma select that feeds `resolveArtworkSale`. Kept here, beside the rule
 * it serves, so a grid query cannot half-adopt it — the exhibition page loads
 * its artworks through two different code paths (snapshot and live), and a
 * field remembered in one and forgotten in the other is invisible until a
 * priced work silently shows no price.
 *
 * `editionNumbers` is a `take: 1` existence probe, not a count: the card only
 * needs to know whether ANY copy is left.
 */
export const SALE_SELECT = {
  editionType: true,
  printEnabled: true,
  printPriceCents: true,
  originalWidth: true,
  originalHeight: true,
  limitedVariants: {
    where: LIVE_VARIANT_WHERE,
    select: {
      name: true,
      priceCents: true,
      paperId: true,
      printTypeId: true,
      widthCm: true,
      heightCm: true,
      borderCm: true,
      sheetWidthCm: true,
      sheetHeightCm: true,
      editionNumbers: { where: { state: 'available' }, select: { id: true }, take: 1 },
    },
  },
} satisfies Prisma.ArtworkSelect

export type SaleRow = SaleArtwork & {
  limitedVariants: (LiveVariant & { editionNumbers: { id: string }[] })[]
}

/**
 * Resolve a row selected with `SALE_SELECT`.
 *
 * Callers must NOT pass the row's pricing inputs on to the client:
 * `printPriceCents` is the ARTIST's cut, not a buyer-facing figure, and the
 * card only ever needs the resolved number.
 */
export function saleFromRow(row: SaleRow): ArtworkSale | null {
  const { limitedVariants, ...artwork } = row
  return resolveArtworkSale(
    artwork,
    limitedVariants.map((v) => ({ ...v, hasAvailableNumber: v.editionNumbers.length > 0 })),
  )
}
