/**
 * Per-artwork print size bounds. The buyer's size picker (and the
 * artist's print-eligibility display) both compute their min / max
 * from these helpers so the wizard and the dashboard stay in sync.
 *
 * Constraints we model:
 *   - Min: 20 cm on EVERY side. Short edge locked at 20 cm; long edge
 *     follows the aspect ratio (e.g. 20 × 27 cm for a 3:4 portrait).
 *   - Max: whichever is smaller of
 *       (a) the file's 300-DPI ceiling on the long edge,
 *       (b) the narrowest paper hardware width (110.5 cm short edge).
 *     Capping at the narrowest paper means every paper option always
 *     supports the displayed range — no per-paper "this size won't
 *     fit on Canson Baryta" surprises mid-flow.
 *   - Long edge hard cap: 200 cm. Above this a print stops being a
 *     consumer purchase — couriers classify tubes >150 cm as oversized
 *     parcels, TPS can't frame anything that big, and demand for
 *     prints over ~180 cm is negligible outside bespoke commissions.
 *
 * Eligibility is "min print would print sharp at MIN_DPI". If the
 * file can't deliver a 20 cm short edge at 300 DPI, no sellable size
 * exists and getPrintMinSize / getPrintMaxSize both return null.
 */

export const MIN_DPI = 300
export const MIN_SHORT_EDGE_CM = 20
export const MAX_SHORT_EDGE_CM = 110.5
export const MAX_LONG_EDGE_CM = 200

export type ImageMeta = { width: number; height: number }

export type PrintSize = { widthCm: number; heightCm: number }

export type PrintLongEdgeBounds = {
  minLongCm: number
  maxLongCm: number
  /** Aspect ratio short/long (≤ 1) */
  aspect: number
  isPortrait: boolean
}

function dpiMaxLongCm(longEdgePx: number): number {
  return (longEdgePx * 2.54) / MIN_DPI
}

function hardwareMaxLongCm(aspect: number): number {
  return Math.min(MAX_LONG_EDGE_CM, MAX_SHORT_EDGE_CM / aspect)
}

/**
 * Compute long-edge cm range for an artwork file. Returns null if the
 * file is too low resolution to produce a sharp smallest-print.
 */
export function getPrintLongEdgeBounds(meta: ImageMeta | null): PrintLongEdgeBounds | null {
  if (!meta || meta.width <= 0 || meta.height <= 0) return null
  const longEdgePx = Math.max(meta.width, meta.height)
  const shortEdgePx = Math.min(meta.width, meta.height)
  const aspect = shortEdgePx / longEdgePx
  const isPortrait = meta.height > meta.width

  const minLongCm = MIN_SHORT_EDGE_CM / aspect
  const maxLongCm = Math.min(dpiMaxLongCm(longEdgePx), hardwareMaxLongCm(aspect))
  if (maxLongCm < minLongCm) return null

  return { minLongCm, maxLongCm, aspect, isPortrait }
}

export function getPrintMinSize(meta: ImageMeta | null): PrintSize | null {
  const bounds = getPrintLongEdgeBounds(meta)
  if (!bounds) return null
  return {
    widthCm: bounds.isPortrait ? MIN_SHORT_EDGE_CM : bounds.minLongCm,
    heightCm: bounds.isPortrait ? bounds.minLongCm : MIN_SHORT_EDGE_CM,
  }
}

export function getPrintMaxSize(meta: ImageMeta | null): PrintSize | null {
  const bounds = getPrintLongEdgeBounds(meta)
  if (!bounds) return null
  const maxShortCm = bounds.maxLongCm * bounds.aspect
  return {
    widthCm: bounds.isPortrait ? maxShortCm : bounds.maxLongCm,
    heightCm: bounds.isPortrait ? bounds.maxLongCm : maxShortCm,
  }
}

/**
 * Convert a long-edge value (cm) into a full H × W size, aspect-locked
 * to the supplied bounds. Used by the wizard's size slider.
 */
export function sizeFromLongEdge(
  longCm: number,
  bounds: Pick<PrintLongEdgeBounds, 'aspect' | 'isPortrait'>,
): PrintSize {
  const shortCm = longCm * bounds.aspect
  return {
    widthCm: bounds.isPortrait ? shortCm : longCm,
    heightCm: bounds.isPortrait ? longCm : shortCm,
  }
}

export function longEdgeOf(size: PrintSize): number {
  return Math.max(size.widthCm, size.heightCm)
}

export function formatPrintSize(heightCm: number, widthCm: number): string {
  // Match the size-input format exactly (0.1 cm step → always one
  // decimal, including trailing .0 on whole-cm values), so the
  // slider min/max labels read identically to the input fields.
  return `${heightCm.toFixed(1)} × ${widthCm.toFixed(1)} cm`
}
