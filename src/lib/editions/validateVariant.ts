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
  computeSheetLayout,
  isFixedSheet,
  TPS_BORDER_REFERENCE_WIDTH_CM,
  TPS_BORDER_CAP_FRACTION,
} from '@/lib/editions/sheetLayout'
import { formatCm } from '@/lib/print-providers/format'
import { estimateVariantMarginCents } from '@/lib/editions/variantMargin'
import {
  TPS_PAPERS,
  TPS_SIZE_BOUNDS,
  TPS_BORDER_BOUNDS,
} from '@/lib/print-providers/printspace/data'
import type { TpsPrintTypeId } from '@/lib/print-providers/printspace/data'
import {
  getPrintLongEdgeBounds,
  MIN_SHORT_EDGE_CM,
} from '@/lib/print-providers/printspace/sizeBounds'

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
  /** Fixed-sheet mode: total sheet in cm. Both null/absent = adaptive. */
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
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

  if (artwork.widthPx <= 0 || artwork.heightPx <= 0) {
    return { ok: false, error: 'Artwork has no usable image dimensions.' }
  }

  // Orientation lock, checked BEFORE the ratio so the artist gets the useful
  // message. The ratio test below compares long/short, which by design ignores
  // orientation — so a portrait print of a landscape work passes it while
  // describing the artwork rotated a quarter turn, which is not the artwork.
  // A square work constrains nothing.
  const artworkLandscape = artwork.widthPx > artwork.heightPx
  const artworkPortrait = artwork.heightPx > artwork.widthPx
  const variantLandscape = variant.widthCm > variant.heightCm
  const variantPortrait = variant.heightCm > variant.widthCm
  if ((artworkLandscape && !variantLandscape) || (artworkPortrait && !variantPortrait)) {
    return {
      ok: false,
      error: artworkLandscape
        ? 'This artwork is landscape, so its prints must be wider than they are tall. Swap the two numbers.'
        : 'This artwork is portrait, so its prints must be taller than they are wide. Swap the two numbers.',
    }
  }

  // Aspect-ratio lock: the variant must keep the artwork's ratio so the print
  // is never cropped or padded.
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

  // ── Fixed-sheet mode ──────────────────────────────────────────
  // The artist pinned the total sheet; the image and per-axis borders are
  // derived. Everything here guards against promising a layout TPS would
  // silently alter.
  const hasAnySheet = variant.sheetWidthCm != null || variant.sheetHeightCm != null
  if (hasAnySheet) {
    if (!isFixedSheet(variant)) {
      return { ok: false, error: 'Set both sheet dimensions, or neither.' }
    }
    const sheetWidthCm = variant.sheetWidthCm as number
    const sheetHeightCm = variant.sheetHeightCm as number

    // The SHEET carries the orientation lock too, not only the derived print.
    // A landscape image centred on a portrait sheet leaves a deep band of paper
    // above and below — a legitimate object, but not this gallery's, and the
    // print inside would still pass the check above because its own shape is
    // correct. Same orientation is the minimum condition for both.
    const sheetLandscape = sheetWidthCm > sheetHeightCm
    const sheetPortrait = sheetHeightCm > sheetWidthCm
    if ((artworkLandscape && sheetPortrait) || (artworkPortrait && sheetLandscape)) {
      return {
        ok: false,
        error: artworkLandscape
          ? 'This artwork is landscape, so its sheet must be landscape too. Swap the sheet’s width and height.'
          : 'This artwork is portrait, so its sheet must be portrait too. Swap the sheet’s width and height.',
      }
    }

    // TPS measures a targeted border at a 40 cm reference width and scales
    // it DOWN below that, so a narrower sheet would not get the border the
    // artist entered and our derived layout would stop matching the print.
    if (sheetWidthCm < TPS_BORDER_REFERENCE_WIDTH_CM) {
      return {
        ok: false,
        error: `The sheet must be at least ${TPS_BORDER_REFERENCE_WIDTH_CM} cm wide — below that the print lab scales the border down and the layout would not match.`,
      }
    }

    // TPS clips a border above a quarter of the shortest side without
    // telling you.
    const capCm = Math.min(sheetWidthCm, sheetHeightCm) * TPS_BORDER_CAP_FRACTION
    if (variant.borderCm > capCm + 0.001) {
      return {
        ok: false,
        error: `On a ${formatCm(sheetHeightCm)} × ${formatCm(sheetWidthCm)} cm sheet the border can be at most ${formatCm(capCm)} cm.`,
      }
    }

    const layout = computeSheetLayout({
      sheetWidthCm,
      sheetHeightCm,
      minBorderCm: variant.borderCm,
      aspectRatio: artwork.widthPx / artwork.heightPx,
    })
    if (!layout) {
      return { ok: false, error: 'That border leaves no printable area on the sheet.' }
    }

    // The stored image size must be exactly what the sheet derives, or the
    // previews, buyer copy and TPS instruction would disagree with the DB.
    if (
      Math.abs(layout.imageWidthCm - variant.widthCm) >= 0.05 ||
      Math.abs(layout.imageHeightCm - variant.heightCm) >= 0.05
    ) {
      return {
        ok: false,
        error: `The print size must be the size derived from the sheet (${formatCm(layout.imageHeightCm)} × ${formatCm(layout.imageWidthCm)} cm).`,
      }
    }

    if (Math.min(layout.imageWidthCm, layout.imageHeightCm) < MIN_SHORT_EDGE_CM) {
      return {
        ok: false,
        error: `The derived print would be ${formatCm(layout.imageHeightCm)} × ${formatCm(layout.imageWidthCm)} cm — its shortest side must be at least ${MIN_SHORT_EDGE_CM} cm. Use a bigger sheet or a smaller border.`,
      }
    }
  }

  // Guardrail: the gallery absorbs the sheet-vs-image cost, so an oversized
  // sheet can silently make every sale lose money. Fixed-sheet mode only —
  // the sheet is free-entry there, so the gap is unbounded.
  const margin = isFixedSheet(variant)
    ? estimateVariantMarginCents({
        widthCm: variant.widthCm,
        heightCm: variant.heightCm,
        borderCm: variant.borderCm,
        sheetWidthCm: variant.sheetWidthCm,
        sheetHeightCm: variant.sheetHeightCm,
        artistPriceCents: variant.priceCents,
      })
    : null
  if (margin && margin.marginCents <= 0) {
    return {
      ok: false,
      error: `This sheet costs more to produce than the variant earns. Raise the price, shrink the sheet, or reduce the border.`,
    }
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
