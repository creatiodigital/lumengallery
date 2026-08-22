/**
 * Narrow a stored `LimitedVariant` row down to what the buyer's wizard is
 * allowed to see.
 *
 * This exists as its own tested function because the mapping used to be
 * written inline in the print page, where it silently dropped
 * `sheetWidthCm`/`sheetHeightCm`. Both are optional on `LimitedVariantView`
 * (an adaptive variant genuinely has neither), so the omission type-checked
 * and shipped: every fixed-sheet edition reached the wizard looking adaptive,
 * and the diagram drew a 50 x 38.2 sheet for a 50 x 40 one. A field dropped
 * here is invisible until someone looks at a rendered sheet, so the mapping
 * belongs somewhere a spec can hold it.
 *
 * Deliberately NOT a spread of the row: the row also carries admin-only
 * columns (block state, ordering, source pixels) that have no business
 * crossing to the client.
 */
import type { LimitedVariantView } from './types'

export type LimitedVariantRow = {
  id: string
  name: string
  paperId: string
  printTypeId: string
  widthCm: number
  heightCm: number
  borderCm: number
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  editionSize: number
  priceCents: number | null
}

/** @param remaining Edition numbers still available to buy. 0 = sold out. */
export function toLimitedVariantView(
  row: LimitedVariantRow,
  remaining: number,
): LimitedVariantView {
  return {
    id: row.id,
    name: row.name,
    paperId: row.paperId,
    printTypeId: row.printTypeId,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    borderCm: row.borderCm,
    // The pair that makes a variant fixed-sheet. `isFixedSheet` needs BOTH,
    // and everything downstream — the picker's "50 x 40 cm sheet" line, the
    // per-axis borders, the 2D diagram, the 3D preview — keys off it.
    sheetWidthCm: row.sheetWidthCm ?? null,
    sheetHeightCm: row.sheetHeightCm ?? null,
    editionSize: row.editionSize,
    priceCents: row.priceCents,
    remaining,
  }
}
