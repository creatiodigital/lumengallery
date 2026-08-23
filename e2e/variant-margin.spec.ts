import { test, expect } from '@playwright/test'
import { estimateVariantMarginCents } from '../src/lib/editions/variantMargin'
import { TPS_GALLERY_MARKUP_RATE } from '../src/lib/print-providers/printspace/pricing'

test('the artist’s real variant leaves a healthy margin', () => {
  const m = estimateVariantMarginCents({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    artistPriceCents: 10000,
  })!
  expect(m.galleryCutCents).toBe(Math.round(10000 * TPS_GALLERY_MARKUP_RATE))
  expect(m.absorbedCents).toBeGreaterThan(0)
  expect(m.marginCents).toBeGreaterThan(0)
})

test('a wildly oversized sheet goes negative', () => {
  const m = estimateVariantMarginCents({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 100,
    sheetHeightCm: 70,
    artistPriceCents: 10000,
  })!
  expect(m.marginCents).toBeLessThan(0)
})

test('an adaptive variant absorbs only the border ring', () => {
  const m = estimateVariantMarginCents({
    widthCm: 27.9,
    heightCm: 40,
    borderCm: 3,
    artistPriceCents: 10000,
  })!
  expect(m.absorbedCents).toBeGreaterThan(0)
  expect(m.marginCents).toBeGreaterThan(0)
})
