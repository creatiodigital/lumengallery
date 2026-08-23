import { test, expect } from '@playwright/test'

import { toLimitedVariantView } from '../src/lib/editions/toLimitedVariantView'
import { variantToWizardConfig } from '../src/lib/editions/variantToWizardConfig'
import { formatCm, formatDualDimensions } from '../src/lib/print-providers/format'

// The real row behind the "40x50 Baryta" edition: a 50 x 40 cm sheet with a
// 7 cm minimum border, whose derived image is 36 x 24.2319 (the artwork is
// 1.486:1, so width binds and the leftover lands on the vertical border).
const STOCK = 88

const FIXED_SHEET_ROW = {
  id: 'v1',
  name: '40x50 Baryta',
  paperId: 'baryta',
  printTypeId: 'giclee',
  widthCm: 36,
  heightCm: 24.2318698789287,
  borderCm: 7,
  sheetWidthCm: 50,
  sheetHeightCm: 40,
  editionSize: 100,
  priceCents: 44400,
}

/**
 * The regression this file exists for: the buyer's print page built its
 * `LimitedVariantView` by hand and dropped `sheetWidthCm`/`sheetHeightCm`.
 * Both are optional on the type, so nothing failed to compile — the wizard
 * simply read every fixed-sheet edition as adaptive and drew a 50 x 38.2
 * sheet (image + 7 on all four sides) for a sheet that is 50 x 40.
 */
test('the view carries the sheet through — the whole fixed-sheet mode depends on it', () => {
  const view = toLimitedVariantView(FIXED_SHEET_ROW, STOCK)
  expect(view.sheetWidthCm).toBe(50)
  expect(view.sheetHeightCm).toBe(40)
  expect(view.remaining).toBe(88)
})

test('a fixed-sheet view yields the per-axis borders the sheet implies', () => {
  const config = variantToWizardConfig(toLimitedVariantView(FIXED_SHEET_ROW, STOCK))
  expect(config.borders!.border.allCm).toBeCloseTo(7, 5)
  expect(config.borders!.border.verticalCm).toBeCloseTo(7.884, 3)
})

// The diagram (SizeSchema) never receives the sheet — it rebuilds it as
// image + 2*border per axis. That reconstruction MUST land back on the sheet
// the artist typed, which is only true when both borders survive the trip.
test('the diagram reconstructs the artist’s sheet, not a squashed one', () => {
  const view = toLimitedVariantView(FIXED_SHEET_ROW, STOCK)
  const border = variantToWizardConfig(view).borders!.border
  const borderYCm = border.verticalCm ?? border.allCm

  expect(view.widthCm + border.allCm * 2).toBeCloseTo(50, 5)
  expect(view.heightCm + borderYCm * 2).toBeCloseTo(40, 5)
})

test('an adaptive variant still reads as image + one uniform border', () => {
  const adaptive = { ...FIXED_SHEET_ROW, sheetWidthCm: null, sheetHeightCm: null }
  const config = variantToWizardConfig(toLimitedVariantView(adaptive, STOCK))
  expect(config.borders!.border.allCm).toBe(7)
  expect(config.borders!.border.verticalCm).toBeUndefined()
})

// The derived print size is stored at full precision on purpose (validation
// requires it to be exactly what the sheet derives), so every surface that
// shows it has to round. This one didn't, and printed
// "24.2318698789287 × 36 cm" on the variant card.
test('sizes are rounded for display, at the 0.1 cm the inputs use', () => {
  expect(formatDualDimensions(36, 24.2318698789287)).toBe('24.2 × 36.0 cm')
  expect(formatDualDimensions(50, 40)).toBe('40.0 × 50.0 cm')
})

// One formatter writes every centimetre length on every surface. Two private
// copies plus a scatter of bare toFixed(1) is how one screen came to show
// "40 × 50 cm sheet" beside "40.0 × 50.0 cm" for the same piece of paper.
test('every centimetre length is written to the same precision', () => {
  // One decimal ALWAYS. Precision that depends on the value is what produced
  // "40 × 50 cm sheet" next to "24.2 × 36.0 cm print" — one object, two
  // notations. Uniform precision is the gallery convention and it makes the
  // agreement structural: nothing has to coordinate with anything else.
  expect(formatCm(40)).toBe('40.0')
  expect(formatCm(50)).toBe('50.0')
  expect(formatCm(24.2318698789287)).toBe('24.2')
  expect(formatCm(7.884)).toBe('7.9')
  expect(formatCm(7)).toBe('7.0')
  // And the two dual-dimension writers agree, because they share it.
  expect(formatDualDimensions(50, 40)).toBe('40.0 × 50.0 cm')
})
