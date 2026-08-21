/**
 * Geometry for a FIXED-SHEET limited-edition variant.
 *
 * Reproduces theprintspace's border algorithm, verified live in the
 * creativehub product wizard on 2026-08-17:
 *   - the border value is a MINIMUM, not an exact value
 *   - the artwork is fitted inside `sheet - 2*minBorder`, preserving its
 *     aspect ratio, and is NEVER cropped
 *   - it is centred, so leftover space on the non-binding axis becomes
 *     extra border on that axis
 *
 * The consequence — and the whole point of the feature — is that a fixed
 * sheet whose shape differs from the artwork's produces DIFFERENT
 * horizontal and vertical borders (50x40 sheet + 3:2 image -> 7 / 8).
 *
 * This module is the single source of truth. Validation, the artist
 * editor, both previewers, buyer-facing specs and the admin TPS
 * instruction all derive from it, so nothing can drift.
 */

/** TPS measures a "targeted" border at a 40 cm-wide reference print and
 *  scales it DOWN on narrower sheets (never up on wider ones). Sheets
 *  below this width would silently receive less border than entered. */
export const TPS_BORDER_REFERENCE_WIDTH_CM = 40

/** TPS caps the border at a quarter of the sheet's shortest side and
 *  silently clips anything larger. */
export const TPS_BORDER_CAP_FRACTION = 0.25

export type SheetLayout = {
  sheetWidthCm: number
  sheetHeightCm: number
  imageWidthCm: number
  imageHeightCm: number
  /** Border on the left and right edges. */
  borderXCm: number
  /** Border on the top and bottom edges. */
  borderYCm: number
}

export type ComputeSheetLayoutArgs = {
  sheetWidthCm: number
  sheetHeightCm: number
  /** Minimum border per side, in cm. */
  minBorderCm: number
  /** Artwork aspect ratio, WIDTH / HEIGHT. */
  aspectRatio: number
}

/**
 * Derive the image size and per-axis borders for a fixed sheet.
 * Returns null when the minimum border leaves no printable area, or when
 * any input is not a usable positive number.
 */
export function computeSheetLayout(args: ComputeSheetLayoutArgs): SheetLayout | null {
  const { sheetWidthCm, sheetHeightCm, minBorderCm, aspectRatio } = args

  if (
    !Number.isFinite(sheetWidthCm) ||
    !Number.isFinite(sheetHeightCm) ||
    !Number.isFinite(minBorderCm) ||
    !Number.isFinite(aspectRatio) ||
    sheetWidthCm <= 0 ||
    sheetHeightCm <= 0 ||
    minBorderCm < 0 ||
    aspectRatio <= 0
  ) {
    return null
  }

  const innerWidthCm = sheetWidthCm - minBorderCm * 2
  const innerHeightCm = sheetHeightCm - minBorderCm * 2
  if (innerWidthCm <= 0 || innerHeightCm <= 0) return null

  // Contain: scale the artwork to the largest size that fits the inner
  // box on BOTH axes. Whichever axis binds gets exactly the minimum
  // border; the other keeps the leftover, split evenly by centring.
  const innerRatio = innerWidthCm / innerHeightCm
  const widthBound = aspectRatio >= innerRatio

  const imageWidthCm = widthBound ? innerWidthCm : innerHeightCm * aspectRatio
  const imageHeightCm = widthBound ? innerWidthCm / aspectRatio : innerHeightCm

  return {
    sheetWidthCm,
    sheetHeightCm,
    imageWidthCm,
    imageHeightCm,
    borderXCm: (sheetWidthCm - imageWidthCm) / 2,
    borderYCm: (sheetHeightCm - imageHeightCm) / 2,
  }
}

/** True when a variant is configured in fixed-sheet mode. Both sheet
 *  dimensions must be present — a half-set pair is adaptive. */
export function isFixedSheet(v: {
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
}): boolean {
  return (
    typeof v.sheetWidthCm === 'number' &&
    Number.isFinite(v.sheetWidthCm) &&
    v.sheetWidthCm > 0 &&
    typeof v.sheetHeightCm === 'number' &&
    Number.isFinite(v.sheetHeightCm) &&
    v.sheetHeightCm > 0
  )
}

export type SeedSheetArgs = {
  /** Current print size in cm, or 0/0 when nothing has been set yet. */
  widthCm: number
  heightCm: number
  borderCm: number
  /** Artwork aspect ratio, WIDTH / HEIGHT. */
  aspectRatio: number
}

/**
 * Choose a starting sheet for the "Fixed sheet" toggle so it never lands
 * the artist on an invalid, unrecognisable card (see isFixedSheet — a 0x0
 * seed would read as adaptive and the toggle would appear to do nothing).
 *
 * When a print size already exists, the sheet is exactly print + border on
 * every side (the same geometry adaptive mode implies) so nothing visibly
 * changes at the moment of switching. Otherwise falls back to the
 * commonest standard paper, oriented to the artwork: 50x40 for
 * landscape/square, 40x50 for portrait. The result always satisfies
 * isFixedSheet.
 */
/** Millimetre precision — matches TPS_SIZE_BOUNDS.stepCm (0.1 cm). */
function roundToMm(cm: number): number {
  return Math.round(cm * 10) / 10
}

export function seedSheetForVariant(args: SeedSheetArgs): {
  sheetWidthCm: number
  sheetHeightCm: number
} {
  const { widthCm, heightCm, borderCm, aspectRatio } = args
  const hasPrint = widthCm > 0 && heightCm > 0
  const sheetWidthCm = hasPrint ? widthCm + borderCm * 2 : aspectRatio >= 1 ? 50 : 40
  const sheetHeightCm = hasPrint ? heightCm + borderCm * 2 : aspectRatio >= 1 ? 40 : 50
  // A sheet is a real piece of paper an artist types a number into, so seed it
  // at mm precision — the same 0.1 cm step every size input uses. The print
  // height it derives from carries the aspect lock's full float, which reached
  // the editor as "39.2665319087496 cm" in the Sheet height field.
  return { sheetWidthCm: roundToMm(sheetWidthCm), sheetHeightCm: roundToMm(sheetHeightCm) }
}

/**
 * May a saved variant be offered as a template for another artwork?
 *
 * ADAPTIVE variants carry the artist's aspect-locked print size, so they only
 * apply to an artwork of the SAME ratio — a near miss would silently change
 * the margin proportions.
 *
 * FIXED-SHEET variants carry the sheet and the minimum border, neither of
 * which depends on the image. The print is derived to fit whatever ratio it
 * lands on, so they apply to ANY artwork; only the second margin differs,
 * which is precisely what fixed-sheet mode is for.
 *
 * Ratios are compared by integer cross-multiplication (no float noise), and
 * pixel RESOLUTION is deliberately ignored: 3000x2000 and 6000x4000 are both
 * exactly 3:2 and print identically.
 */
export function isVariantTemplateApplicable(
  template: {
    sheetWidthCm?: number | null
    sheetHeightCm?: number | null
    sourceWidthPx?: number | null
    sourceHeightPx?: number | null
  },
  target: { widthPx?: number | null; heightPx?: number | null },
): boolean {
  if (template.sheetWidthCm != null && template.sheetHeightCm != null) return true
  const { sourceWidthPx: sw, sourceHeightPx: sh } = template
  const { widthPx: tw, heightPx: th } = target
  if (!sw || !sh || !tw || !th) return false
  return sw * th === sh * tw
}

/**
 * Identity of a variant TEMPLATE, for deduping the "Apply saved variant"
 * picker. Two of the artist's variants are the same template when they were
 * authored the same, which differs by mode:
 *
 *  - FIXED SHEET — the artist authored the SHEET and a minimum border.
 *    `widthCm`/`heightCm` are the image DERIVED from that sheet against each
 *    source artwork's own ratio, so one authored template stored on two
 *    differently-proportioned artworks carries different derived sizes.
 *    Including them listed the same template twice.
 *  - ADAPTIVE — `widthCm`/`heightCm` ARE the authored, aspect-locked print
 *    size, so they are exactly what identifies it.
 *
 * Lengths are rounded to the 0.1 cm the UI displays so float noise from the
 * derivation can't split two identical templates apart.
 */
export function variantTemplateKey(v: {
  name: string
  paperId: string
  widthCm: number
  heightCm: number
  borderCm: number
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  editionSize: number
}): string {
  const cm = (n: number) => n.toFixed(1)
  return isFixedSheet(v)
    ? `sheet|${v.name}|${v.paperId}|${cm(v.sheetHeightCm as number)}x${cm(v.sheetWidthCm as number)}|${cm(v.borderCm)}|${v.editionSize}`
    : `print|${v.name}|${v.paperId}|${cm(v.heightCm)}x${cm(v.widthCm)}|${cm(v.borderCm)}|${v.editionSize}`
}
