import { test, expect } from '@playwright/test'
import { computeSheetLayout, isFixedSheet, seedSheetForVariant } from '../src/lib/editions/sheetLayout'

// The editor keeps widthCm/heightCm in lockstep with the sheet. This spec
// asserts the derivation the UI performs, so a refactor that stops
// re-deriving on border change is caught.
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

// Regression: `setSheetMode` calls seedSheetForVariant to fill in the sheet
// when the "Fixed sheet" button is clicked. It used to inline a 0x0 seed
// for a variant with no print size yet, which isFixedSheet rejects — so
// the toggle updated state but never actually flipped the mode on a
// freshly added variant, and read as dead. These tests exercise the real
// seeding function the component calls, not just the geometry underneath.
test('seedSheetForVariant preserves an existing print size as print + 2*border', () => {
  const seed = seedSheetForVariant({ widthCm: 30, heightCm: 20, borderCm: 5, aspectRatio: 1.5 })
  expect(seed).toEqual({ sheetWidthCm: 40, sheetHeightCm: 30 })
  expect(isFixedSheet(seed)).toBe(true)
})

test('seedSheetForVariant falls back to a standard sheet, oriented to the artwork, when there is no print size yet', () => {
  const landscape = seedSheetForVariant({ widthCm: 0, heightCm: 0, borderCm: 3, aspectRatio: 1.5 })
  expect(landscape).toEqual({ sheetWidthCm: 50, sheetHeightCm: 40 })
  expect(isFixedSheet(landscape)).toBe(true)

  const portrait = seedSheetForVariant({ widthCm: 0, heightCm: 0, borderCm: 3, aspectRatio: 2 / 3 })
  expect(portrait).toEqual({ sheetWidthCm: 40, sheetHeightCm: 50 })
  expect(isFixedSheet(portrait)).toBe(true)
})
