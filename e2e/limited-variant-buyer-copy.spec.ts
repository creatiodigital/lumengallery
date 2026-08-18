import { test, expect } from '@playwright/test'
import { computeSheetLayout } from '../src/lib/editions/sheetLayout'

// The buyer must never be shown a single border figure for a fixed-sheet
// edition — the two axes genuinely differ and the sheet is the object sold.
test('fixed-sheet borders differ enough to require both figures', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  expect(Math.abs(layout.borderYCm - layout.borderXCm)).toBeGreaterThanOrEqual(0.05)
})

test('a same-shape sheet keeps a single border figure', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 36 + 6,
    sheetHeightCm: 24 + 6,
    minBorderCm: 3,
    aspectRatio: 1.5,
  })!
  expect(Math.abs(layout.borderYCm - layout.borderXCm)).toBeLessThan(0.05)
})
