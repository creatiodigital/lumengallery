import { test, expect } from '@playwright/test'
import {
  computeSheetLayout,
  isFixedSheet,
  TPS_BORDER_REFERENCE_WIDTH_CM,
  TPS_BORDER_CAP_FRACTION,
} from '../src/lib/editions/sheetLayout'

// The verified case, confirmed against theprintspace's own full preview
// on 2026-08-17: a 3:2 landscape artwork on a 50 x 40 cm sheet with a
// 7 cm minimum border yields a 36 x 24 image and 7 / 8 borders.
test('verified TPS case: 50x40 sheet, 7cm minimum, 3:2 image', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })
  expect(layout).not.toBeNull()
  expect(layout!.imageWidthCm).toBeCloseTo(36, 5)
  expect(layout!.imageHeightCm).toBeCloseTo(24, 5)
  expect(layout!.borderXCm).toBeCloseTo(7, 5)
  expect(layout!.borderYCm).toBeCloseTo(8, 5)
})

// Width-bound: the image is WIDER than the inner box, so width pins to
// the minimum and the leftover lands on the vertical borders.
test('width-bound image pins the horizontal border to the minimum', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 6,
    aspectRatio: 1.5,
  })!
  // inner 38 x 28, ratio 1.357 < 1.5 -> width-bound
  expect(layout.imageWidthCm).toBeCloseTo(38, 5)
  expect(layout.imageHeightCm).toBeCloseTo(38 / 1.5, 5)
  expect(layout.borderXCm).toBeCloseTo(6, 5)
  expect(layout.borderYCm).toBeGreaterThan(6)
})

// Height-bound: a squarer image than the inner box pins the vertical
// border instead, and the leftover lands on the horizontal borders.
test('height-bound image pins the vertical border to the minimum', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 60,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.0,
  })!
  // inner 46 x 26, ratio 1.769 > 1.0 -> height-bound
  expect(layout.imageHeightCm).toBeCloseTo(26, 5)
  expect(layout.imageWidthCm).toBeCloseTo(26, 5)
  expect(layout.borderYCm).toBeCloseTo(7, 5)
  expect(layout.borderXCm).toBeCloseTo(17, 5)
})

test('portrait sheet with portrait artwork', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 40,
    sheetHeightCm: 50,
    minBorderCm: 7,
    aspectRatio: 2 / 3,
  })!
  // inner 26 x 36, ratio 0.722 > 0.667 -> height-bound
  expect(layout.imageHeightCm).toBeCloseTo(36, 5)
  expect(layout.imageWidthCm).toBeCloseTo(24, 5)
  expect(layout.borderYCm).toBeCloseTo(7, 5)
  expect(layout.borderXCm).toBeCloseTo(8, 5)
})

test('returns null when the border consumes the sheet', () => {
  expect(
    computeSheetLayout({
      sheetWidthCm: 20,
      sheetHeightCm: 20,
      minBorderCm: 10,
      aspectRatio: 1.5,
    }),
  ).toBeNull()
})

test('sheet dimensions are echoed back unchanged', () => {
  const layout = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  expect(layout.sheetWidthCm).toBe(50)
  expect(layout.sheetHeightCm).toBe(40)
})

test('isFixedSheet requires both dimensions', () => {
  expect(isFixedSheet({ sheetWidthCm: 50, sheetHeightCm: 40 })).toBe(true)
  expect(isFixedSheet({ sheetWidthCm: 50, sheetHeightCm: null })).toBe(false)
  expect(isFixedSheet({ sheetWidthCm: null, sheetHeightCm: null })).toBe(false)
  expect(isFixedSheet({})).toBe(false)
})

test('TPS constants match the observed wizard behaviour', () => {
  expect(TPS_BORDER_REFERENCE_WIDTH_CM).toBe(40)
  expect(TPS_BORDER_CAP_FRACTION).toBe(0.25)
})
