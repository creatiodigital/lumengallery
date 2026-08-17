import { test, expect } from '@playwright/test'
import { computeSheetLayout } from '../src/lib/editions/sheetLayout'

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
