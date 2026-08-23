/**
 * Generates the exact creativehub product-wizard inputs for a variant, so
 * the configuration can be reproduced by hand without arithmetic.
 *
 * Why this exists: TPS is WIDTH-first while every other surface in this app
 * is HEIGHT × WIDTH, and their border field is in millimetres while ours is
 * in centimetres. Both conversions are easy to get wrong by hand and the
 * failure is expensive — a transposed sheet prints the wrong object. This
 * module does them once and labels the result.
 *
 * The same generator backs the artist editor card and the admin order
 * instruction, so the product config and the order can never disagree.
 */
import { computeSheetLayout, isFixedSheet } from '@/lib/editions/sheetLayout'
// ONE formatter writes every centimetre length in this app. A private round1
// lived here and printed "7" where every other surface printed "7.0".
import { formatCm } from '@/lib/print-providers/format'

const CM_PER_INCH = 2.54

/** TPS offers Even / Bottom weighted / Aspect ratio. We model Even only. */
const DISTRIBUTION = 'Even' as const

/** The fit-method option to pick when a sheet is off-ratio. Never crop. */
const FIT_METHOD = 'Add a border (keep whole artwork)'

export type TpsRecipe = {
  /** Sheet size in cm, WIDTH first — the order the TPS field expects. */
  sheetWidthCm: number
  sheetHeightCm: number
  /** The same sheet in inches, as the TPS row shows alongside cm. */
  sheetWidthIn: number
  sheetHeightIn: number
  /** Targeted/minimum border in mm — the unit of the TPS field. */
  borderMm: number
  distribution: typeof DISTRIBUTION
  fitMethod: string
  paperLabel: string
  /** What the creativehub preview must show. The acceptance test. */
  expectedImageWidthCm: number
  expectedImageHeightCm: number
  expectedBorderXCm: number
  expectedBorderYCm: number
}

export type BuildTpsRecipeArgs = {
  /** Image size in cm. */
  widthCm: number
  heightCm: number
  /** Border in cm — exact in adaptive mode, minimum in fixed-sheet mode. */
  borderCm: number
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  paperLabel: string
}

// Inches get the same one-decimal treatment as centimetres. No shared inch
// formatter exists because this file is the only place the app speaks inches —
// TPS's form offers them and the operator may be reading either column. The
// recipe itself holds raw numbers; formatting happens here, at the boundary.
const oneDecimal = (n: number) => n.toFixed(1)

export function buildTpsRecipe(args: BuildTpsRecipeArgs): TpsRecipe | null {
  const { widthCm, heightCm, borderCm, paperLabel } = args

  if (
    !Number.isFinite(widthCm) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(borderCm) ||
    widthCm <= 0 ||
    heightCm <= 0 ||
    borderCm < 0
  ) {
    return null
  }

  // Adaptive mode: the sheet is simply the image plus the border on each
  // side, so both axes get the same border and there is nothing to derive.
  const fixed = isFixedSheet(args)
  const sheetWidthCm = fixed ? (args.sheetWidthCm as number) : widthCm + borderCm * 2
  const sheetHeightCm = fixed ? (args.sheetHeightCm as number) : heightCm + borderCm * 2

  const layout = computeSheetLayout({
    sheetWidthCm,
    sheetHeightCm,
    minBorderCm: borderCm,
    aspectRatio: widthCm / heightCm,
  })
  if (!layout) return null

  return {
    sheetWidthCm,
    sheetHeightCm,
    sheetWidthIn: sheetWidthCm / CM_PER_INCH,
    sheetHeightIn: sheetHeightCm / CM_PER_INCH,
    borderMm: Math.round(borderCm * 10),
    distribution: DISTRIBUTION,
    fitMethod: FIT_METHOD,
    paperLabel,
    expectedImageWidthCm: layout.imageWidthCm,
    expectedImageHeightCm: layout.imageHeightCm,
    expectedBorderXCm: layout.borderXCm,
    expectedBorderYCm: layout.borderYCm,
  }
}

/**
 * Renders the recipe as the copyable block shown in the editor and pasted
 * into the order notes. Dimensions are width-first and say so, because the
 * reader is about to type them into a width-first form.
 */
export function formatTpsRecipe(recipe: TpsRecipe, opts?: { title?: string }): string {
  const lines: string[] = []
  if (opts?.title) lines.push(`TPS setup — ${opts.title}`, '')
  lines.push(
    `Custom size (W × H)   ${formatCm(recipe.sheetWidthCm)} × ${formatCm(recipe.sheetHeightCm)} cm      (${oneDecimal(recipe.sheetWidthIn)} × ${oneDecimal(recipe.sheetHeightIn)} in)`,
    `Fit method            ${recipe.fitMethod}`,
    `Border size           Custom`,
    `Distribution          ${recipe.distribution}`,
    `Units                 Millimeters`,
    `Targeted border       ${recipe.borderMm} mm`,
    `Paper                 ${recipe.paperLabel}`,
    '',
    `Expect: image ${formatCm(recipe.expectedImageWidthCm)} × ${formatCm(recipe.expectedImageHeightCm)} cm · borders ${formatCm(recipe.expectedBorderXCm)} h / ${formatCm(recipe.expectedBorderYCm)} v`,
  )
  return lines.join('\n')
}
