import { test, expect } from '@playwright/test'
import { validateVariantInput } from '../src/lib/editions/validateVariant'
import { computeSheetLayout } from '../src/lib/editions/sheetLayout'

// A 3:2 landscape file, large enough to print at these sizes at 300 DPI.
const ARTWORK_3_2 = { widthPx: 7200, heightPx: 4800 }

const baseVariant = {
  name: 'Standard',
  paperId: 'hahnemuhle-german-etching',
  widthCm: 36,
  heightCm: 24,
  borderCm: 7,
  editionSize: 50,
  priceCents: 10000,
}

test('accepts a valid fixed-sheet variant', () => {
  const res = validateVariantInput({
    variant: { ...baseVariant, sheetWidthCm: 50, sheetHeightCm: 40 },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(true)
})

test('rejects a fixed sheet whose derived image disagrees with the stored size', () => {
  const res = validateVariantInput({
    // 50x40 with a 7cm minimum derives a 36x24 image, not 30x20.
    variant: { ...baseVariant, widthCm: 30, heightCm: 20, sheetWidthCm: 50, sheetHeightCm: 40 },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain('derived')
})

// Fixture note: the derived image must stay INSIDE this file's printable
// long-edge range (30.0-60.96 cm for 7200x4800) or the pre-existing
// long-edge check fires first and this assertion never reaches the 40 cm
// rule. Sheet 38x30 with a 3 cm border derives a 32 x 21.3 image, which is
// in range, so the sheet-width rule is what rejects it.
test('rejects a sheet narrower than the TPS reference width', () => {
  const res = validateVariantInput({
    variant: {
      ...baseVariant,
      widthCm: 32,
      heightCm: 32 / 1.5,
      borderCm: 3,
      sheetWidthCm: 38,
      sheetHeightCm: 30,
    },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain('40 cm')
})

// Fixture note: the sheet cap must be DISTINCT from the generic 10 cm
// border ceiling or this test cannot tell the two rules apart. A 40x20
// sheet gives a cap of 5 cm, so a 7 cm border passes the generic ceiling
// and is rejected by the cap alone.
test('rejects a border above a quarter of the shortest sheet side', () => {
  const res = validateVariantInput({
    variant: { ...baseVariant, borderCm: 7, sheetWidthCm: 40, sheetHeightCm: 20 },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain('5.0 cm')
})

test('rejects only one sheet dimension being set', () => {
  const res = validateVariantInput({
    variant: { ...baseVariant, sheetWidthCm: 50, sheetHeightCm: null },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain('both')
})

test('adaptive variants are unaffected', () => {
  const res = validateVariantInput({
    variant: { ...baseVariant, widthCm: 45, heightCm: 30 },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(true)
})

test('changing the sheet changes the derived image', () => {
  const a = computeSheetLayout({
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  const b = computeSheetLayout({
    sheetWidthCm: 60,
    sheetHeightCm: 40,
    minBorderCm: 7,
    aspectRatio: 1.5,
  })!
  expect(a.imageWidthCm).not.toBeCloseTo(b.imageWidthCm, 2)
})
