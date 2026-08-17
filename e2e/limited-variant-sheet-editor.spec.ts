import { test, expect } from '@playwright/test'
import { computeSheetLayout, isFixedSheet } from '../src/lib/editions/sheetLayout'

// The editor keeps widthCm/heightCm in lockstep with the sheet. This spec
// asserts the derivation the UI performs, so a refactor that stops
// re-deriving on border change is caught.
test('editor derivation: 50x40 sheet with a 7cm border derives 36x24', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  expect(layout.imageWidthCm).toBeCloseTo(36, 5)
  expect(layout.imageHeightCm).toBeCloseTo(24, 5)
})

test('editor derivation: changing the border re-derives the image', () => {
  const before = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  const after = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 6,
    aspectRatio: 1.5,
  })!
  expect(after.imageWidthCm).toBeGreaterThan(before.imageWidthCm)
})

// Regression: seeding a zero sheet left isFixedSheet false, so the "Fixed
// sheet" button updated state but never flipped the mode — it read as broken.
test('a seeded sheet is always recognised as fixed-sheet mode', () => {
  // Landscape artwork, no print size yet -> standard 50 x 40.
  expect(isFixedSheet({ sheetWidthCm: 50, sheetHeightCm: 40 })).toBe(true)
  // Portrait artwork, no print size yet -> standard 40 x 50.
  expect(isFixedSheet({ sheetWidthCm: 40, sheetHeightCm: 50 })).toBe(true)
  // The old zero seed, which is what broke it.
  expect(isFixedSheet({ sheetWidthCm: 0, sheetHeightCm: 0 })).toBe(false)
})
