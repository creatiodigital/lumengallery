/**
 * ONE definition of "a buyer can purchase a print of this artwork".
 *
 * The rule forks on edition type, and getting the fork wrong is invisible until
 * a buyer hits a 404:
 *
 *   - OPEN editions are priced on the ARTWORK (`printPriceCents`).
 *   - LIMITED editions have NO artwork-level price. They are priced PER VARIANT,
 *     and are only purchasable while a variant is `published && blocked` — an
 *     unblocked variant is paused from sale and refuses reservations.
 *
 * Before this existed the catalog, the print wizard, checkout, payment, the
 * public prints API and admin analytics each spelled the rule out for
 * themselves, and every one of them gated on `printPriceCents` alone. On
 * 2026-08-21 that meant three of five live artworks were missing from /prints
 * and `notFound()` on "Order Print" — priced, live, and unreachable.
 *
 * `validateAndPriceItem` is the authority on what checkout accepts; this mirrors
 * it. Anything hidden here is unsellable in practice, and anything shown that
 * checkout would refuse is a dead end for a buyer.
 */
import type { Prisma } from '@/generated/prisma'

/** A live, priced variant — the only kind a buyer can reserve against. */
export const LIVE_VARIANT_WHERE = {
  published: true,
  blocked: true,
  priceCents: { not: null },
} satisfies Prisma.LimitedVariantWhereInput

/**
 * Prisma `where` fragment for list queries (catalog, public API). Combine with
 * whatever else the caller needs — e.g. `user: { published: true }`.
 */
export const purchasableArtworkWhere = (): Prisma.ArtworkWhereInput => ({
  printEnabled: true,
  OR: [
    { editionType: { not: 'limited' }, printPriceCents: { not: null } },
    { editionType: 'limited', limitedVariants: { some: LIVE_VARIANT_WHERE } },
  ],
})

/**
 * The same rule for an artwork already loaded on a page. `liveVariantCount` is
 * how many variants matched `LIVE_VARIANT_WHERE` — pass 0 for an open edition,
 * where it is irrelevant.
 */
export function isArtworkPurchasable(artwork: {
  printEnabled: boolean
  editionType: string
  printPriceCents: number | null
  liveVariantCount: number
}): boolean {
  if (!artwork.printEnabled) return false
  return artwork.editionType === 'limited'
    ? artwork.liveVariantCount > 0
    : artwork.printPriceCents != null
}
