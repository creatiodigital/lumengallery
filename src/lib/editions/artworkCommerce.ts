import { SALE_SELECT, saleFromRow, type SaleRow } from './artworkSale'
import { getVariantEditionLines, variantEditionLineParts } from './variantEditionLines'
import type { VariantEditionLineParts } from './variantEditionLines'

/**
 * Everything a buyer-facing surface needs to describe a sale — and nothing else.
 *
 * Built here rather than at each call site because the artwork page and the
 * in-exhibition modal must agree: they show the same work, and a figure that
 * differed between them would be a bug nobody would notice until a buyer did.
 *
 * Note what is NOT in here. `printPriceCents` is the ARTIST's cut, not a price
 * anyone pays, and both surfaces used to ship it to the browser — from which
 * the gallery's margin is one subtraction away. The resolved figures below are
 * all a client ever needs.
 */
export type ArtworkCommercePayload = {
  editionType: 'open' | 'limited'
  /** Cheapest completable purchase. `null` means live but sold out. */
  minPriceCents: number | null
  /** Every live edition, each priced on its own row. Empty for open editions. */
  editionLines: VariantEditionLineParts[]
}

/** The `select` a caller needs so its row can be handed to `buildArtworkCommerce`. */
export const COMMERCE_SELECT = SALE_SELECT

export async function buildArtworkCommerce(
  artworkId: string,
  row: SaleRow,
): Promise<ArtworkCommercePayload | null> {
  const sale = saleFromRow(row)
  if (!sale) return null

  // Only limited editions have variants to enumerate; an open edition is a
  // continuous range with no copy numbers at all.
  const lines = sale.editionType === 'limited' ? await getVariantEditionLines(artworkId) : []

  return {
    editionType: sale.editionType,
    minPriceCents: sale.minPriceCents,
    editionLines: lines.map(variantEditionLineParts),
  }
}
