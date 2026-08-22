/**
 * Estimates what the gallery keeps on one print of a variant.
 *
 * Context (decision 2026-08-17): buyer pricing is computed from the IMAGE
 * area, but theprintspace bills us for the SHEET. The gallery absorbs the
 * difference rather than raising buyer prices. That is fine at ordinary
 * border sizes and ruinous at extreme ones, so the editor shows this number
 * and validation blocks a negative one.
 *
 * Deliberately approximate: it compares print-base cost on the two areas
 * and ignores shipping (which lands in the same band in every realistic
 * case) and the per-order COA + letter cost. It exists to catch a
 * configuration mistake, not to be an accounting figure.
 */
import {
  getPrintBaseCents,
  TPS_GALLERY_MARKUP_RATE,
} from '@/lib/print-providers/printspace/pricing'
import { buildTpsRecipe } from '@/lib/editions/tpsRecipe'

export type VariantMargin = {
  /** What the gallery charges on top of the artist's cut. */
  galleryCutCents: number
  /** Sheet cost minus the image cost the buyer was charged for. */
  absorbedCents: number
  /** What is left. Negative means every sale loses money. */
  marginCents: number
}

export function estimateVariantMarginCents(args: {
  widthCm: number
  heightCm: number
  borderCm: number
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  artistPriceCents: number
}): VariantMargin | null {
  const recipe = buildTpsRecipe({ ...args, paperLabel: '' })
  if (!recipe || !Number.isFinite(args.artistPriceCents) || args.artistPriceCents <= 0) {
    return null
  }

  const imageCents = getPrintBaseCents(args.widthCm, args.heightCm)
  const sheetCents = getPrintBaseCents(recipe.sheetWidthCm, recipe.sheetHeightCm)
  const absorbedCents = Math.max(0, sheetCents - imageCents)
  const galleryCutCents = Math.round(args.artistPriceCents * TPS_GALLERY_MARKUP_RATE)

  return {
    galleryCutCents,
    absorbedCents,
    marginCents: galleryCutCents - absorbedCents,
  }
}
