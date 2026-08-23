import { test, expect } from '@playwright/test'
import { validateVariantInput } from '../src/lib/editions/validateVariant'
import { computeSheetLayout } from '../src/lib/editions/sheetLayout'
import { TPS_GALLERY_MARKUP_RATE } from '../src/lib/print-providers/printspace/pricing'

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

// This proves an INVARIANT that makes the lock robust, not the lock itself:
// because the image size is derived from the sheet, a sheet swap always
// changes widthCm/heightCm too, so it can never slip past the size check
// in saveLimitedVariants unnoticed.
//
// NOT COVERED: the `sheetChanged` branch itself. Exercising it needs
// saveLimitedVariants run against a blocked+published row, which needs the
// dev DB to have the sheet columns. Tracked as a follow-up.
test('a sheet change always changes the derived image size', () => {
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

// ── Margin gate ────────────────────────────────────────────────────
//
// Every earlier fixed-sheet rule must pass for this fixture, or the
// rejection would prove nothing about the margin gate specifically. The
// sheet is 51 x 150 cm with a 3 cm minimum border: on a 3:2 image the
// width binds (image width = sheet width - 2*border = 45), so almost
// all of the sheet's 150 cm height becomes pure leftover border on that
// axis — a huge sheet around a comparatively tiny, in-range image. The
// image size is DERIVED via computeSheetLayout, not hand-guessed, so it
// exactly satisfies the "stored size must match the derivation" check,
// sits inside this file's 30.0-60.96 cm printable range (45 cm long
// edge), and clears the 20 cm short-edge floor (30 cm).
// A LONG, NARROW landscape sheet: 150 × 44 keeps the derived image (57 × 38)
// inside the file's printable range while the sheet itself stays enormous, so
// the sheet-vs-image cost gap is what the variant is judged on. Orientation
// must match the landscape artwork — a portrait sheet is refused before the
// cost gate is reached — and the image must not exceed the 61 cm long-edge cap
// for this file, which is what a 150 × 51 sheet did.
const bigSheetLayout = computeSheetLayout({
  sheetWidthCm: 150,
  sheetHeightCm: 44,
  minBorderCm: 3,
  aspectRatio: 1.5,
})!

test('rejects a fixed sheet that costs more to produce than the variant earns', () => {
  const res = validateVariantInput({
    variant: {
      ...baseVariant,
      widthCm: bigSheetLayout.imageWidthCm,
      heightCm: bigSheetLayout.imageHeightCm,
      borderCm: 3,
      sheetWidthCm: 150,
      sheetHeightCm: 44,
      // Low price -> gallery cut (price * TPS_GALLERY_MARKUP_RATE) is
      // nowhere near enough to cover the sheet-vs-image cost gap.
      priceCents: 500,
    },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain('costs more to produce')
})

// Mirror case: same oversized sheet, but a price whose gallery cut
// (priceCents * TPS_GALLERY_MARKUP_RATE) clears the absorbed cost —
// proves the gate discriminates on margin, not on sheet size alone.
test('the same oversized sheet passes once the price covers the absorbed cost', () => {
  const priceCents = 20000
  expect(priceCents * TPS_GALLERY_MARKUP_RATE).toBeGreaterThan(6000) // sanity: cut clears the gap
  const res = validateVariantInput({
    variant: {
      ...baseVariant,
      widthCm: bigSheetLayout.imageWidthCm,
      heightCm: bigSheetLayout.imageHeightCm,
      borderCm: 3,
      sheetWidthCm: 150,
      sheetHeightCm: 44,
      priceCents,
    },
    artwork: ARTWORK_3_2,
    siblingSizes: [],
  })
  expect(res.ok).toBe(true)
})
