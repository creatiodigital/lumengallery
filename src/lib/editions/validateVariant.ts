/**
 * Server-authoritative validation for a single limited-edition variant.
 *
 * Mirrors the rules baked into the dashboard variant editor, but is the
 * real gate (the UI checks are convenience). Enforces the product rules
 * decided for limited editions:
 *   - paper must be a real TPS paper; print type is DERIVED from it
 *   - size is locked to the artwork's aspect ratio (no crop/pad)
 *   - size sits within the file's printable range + TPS hardware bounds
 *   - the border is generous enough to hold the bottom-left number AND
 *     leave room for a buyer's own passepartout
 *   - sizes are DISTINCT across an artwork's variants (TPS keys edition
 *     identity on the unframed print size)
 */
import {
  TPS_PAPERS,
  TPS_SIZE_BOUNDS,
  TPS_BORDER_BOUNDS,
} from '@/lib/print-providers/printspace/data'
import type { TpsPrintTypeId } from '@/lib/print-providers/printspace/data'
import { getPrintLongEdgeBounds } from '@/lib/print-providers/printspace/sizeBounds'

/**
 * Minimum paper border for a limited edition, in cm. Large enough for
 * the printed "1/50" number row plus a buyer's own passepartout if they
 * frame it themselves. Tunable — confirm against the print lab. (The
 * open-edition border min is 0; limited deliberately forces a margin.)
 */
export const LIMITED_BORDER_MIN_CM = 3

/** Max variants per limited artwork: 1 mandatory + 3 optional. */
export const MAX_LIMITED_VARIANTS = 4

/** Aspect-ratio match tolerance (relative). Sub-percent rounding is fine. */
const ASPECT_TOLERANCE = 0.02

export type VariantInput = {
  name: string
  paperId: string
  widthCm: number
  heightCm: number
  borderCm: number
  editionSize: number
  /** Artist's cut for this variant, in cents. Required (> 0). */
  priceCents: number
}

export type ValidateVariantArgs = {
  variant: VariantInput
  /** Artwork pixel dimensions — drives aspect lock + DPI eligibility. */
  artwork: { widthPx: number; heightPx: number }
  /** Other variants' sizes on the same artwork, for the distinctness check. */
  siblingSizes: { widthCm: number; heightCm: number }[]
}

export type ValidateVariantResult =
  | { ok: true; printTypeId: TpsPrintTypeId }
  | { ok: false; error: string }

export function validateVariantInput(args: ValidateVariantArgs): ValidateVariantResult {
  const { variant, artwork, siblingSizes } = args

  if (!variant.name.trim()) {
    return { ok: false, error: 'Variant name is required.' }
  }

  const paper = TPS_PAPERS.find((p) => p.id === variant.paperId)
  if (!paper) {
    return { ok: false, error: 'Unknown paper.' }
  }

  if (!Number.isFinite(variant.widthCm) || !Number.isFinite(variant.heightCm)) {
    return { ok: false, error: 'Invalid size.' }
  }

  const longCm = Math.max(variant.widthCm, variant.heightCm)
  const shortCm = Math.min(variant.widthCm, variant.heightCm)
  if (shortCm < TPS_SIZE_BOUNDS.minCm || longCm > TPS_SIZE_BOUNDS.maxCm) {
    return {
      ok: false,
      error: `Size must be between ${TPS_SIZE_BOUNDS.minCm} cm and ${TPS_SIZE_BOUNDS.maxCm} cm.`,
    }
  }

  // Aspect-ratio lock: the variant must keep the artwork's ratio so the
  // print is never cropped or padded. Compare on the long/short ratio so
  // orientation doesn't matter.
  if (artwork.widthPx <= 0 || artwork.heightPx <= 0) {
    return { ok: false, error: 'Artwork has no usable image dimensions.' }
  }
  const artworkRatio =
    Math.max(artwork.widthPx, artwork.heightPx) / Math.min(artwork.widthPx, artwork.heightPx)
  const variantRatio = longCm / shortCm
  if (Math.abs(variantRatio - artworkRatio) / artworkRatio > ASPECT_TOLERANCE) {
    return { ok: false, error: 'Size must match the artwork’s aspect ratio.' }
  }

  // File resolution + DPI ceiling: the variant can't be larger than the
  // file can print sharply. Same bound the dashboard slider + buyer wizard
  // use — enforced here so a tampered save can't exceed it either.
  const bounds = getPrintLongEdgeBounds({ width: artwork.widthPx, height: artwork.heightPx })
  if (!bounds) {
    return { ok: false, error: 'This image is too low-resolution to print at any size.' }
  }
  // Small tolerance for cm rounding between the slider and this check.
  if (longCm < bounds.minLongCm - 0.5 || longCm > bounds.maxLongCm + 0.5) {
    return {
      ok: false,
      error: `For this file, the longest side must be between ${bounds.minLongCm.toFixed(0)} cm and ${bounds.maxLongCm.toFixed(0)} cm.`,
    }
  }

  if (
    !Number.isFinite(variant.borderCm) ||
    variant.borderCm < LIMITED_BORDER_MIN_CM ||
    variant.borderCm > TPS_BORDER_BOUNDS.maxCm
  ) {
    return {
      ok: false,
      error: `Border must be between ${LIMITED_BORDER_MIN_CM} cm and ${TPS_BORDER_BOUNDS.maxCm} cm.`,
    }
  }

  if (!Number.isInteger(variant.editionSize) || variant.editionSize < 1) {
    return { ok: false, error: 'Edition size must be a whole number of at least 1.' }
  }

  if (!Number.isInteger(variant.priceCents) || variant.priceCents < 1) {
    return { ok: false, error: 'Each variant needs a price greater than 0.' }
  }

  // Distinct print size within the artwork — TPS edition-identity rule.
  const clash = siblingSizes.some(
    (s) => sameSize(s.widthCm, variant.widthCm) && sameSize(s.heightCm, variant.heightCm),
  )
  if (clash) {
    return { ok: false, error: 'Each variant must have a distinct print size.' }
  }

  return { ok: true, printTypeId: paper.printType }
}

function sameSize(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05
}
