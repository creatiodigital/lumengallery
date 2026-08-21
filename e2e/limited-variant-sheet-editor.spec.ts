import { test, expect } from '@playwright/test'
import {
  computeSheetLayout,
  isFixedSheet,
  isVariantTemplateApplicable,
  variantTemplateKey,
  seedSheetForVariant,
} from '../src/lib/editions/sheetLayout'
import { remapIndexKeys } from '../src/components/shared/ArtworkEditForm/LimitedVariantsEditor/remapIndexKeys'

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

test('seedSheetForVariant seeds whole millimetres, not the aspect lock raw float', () => {
  // A 36 cm wide print on a 4000x2806 artwork derives 25.2665319087496 cm of
  // height; with a 7 cm border the naive sheet is 39.2665319087496, which the
  // artist then sees in an input beside a border field marked "whole cm".
  const seeded = seedSheetForVariant({
    widthCm: 36,
    heightCm: 25.2665319087496,
    borderCm: 7,
    aspectRatio: 36 / 25.2665319087496,
  })
  expect(seeded.sheetWidthCm).toBe(50)
  expect(seeded.sheetHeightCm).toBe(39.3)
})

test('seedSheetForVariant falls back to a standard sheet, oriented to the artwork, when there is no print size yet', () => {
  const landscape = seedSheetForVariant({ widthCm: 0, heightCm: 0, borderCm: 3, aspectRatio: 1.5 })
  expect(landscape).toEqual({ sheetWidthCm: 50, sheetHeightCm: 40 })
  expect(isFixedSheet(landscape)).toBe(true)

  const portrait = seedSheetForVariant({ widthCm: 0, heightCm: 0, borderCm: 3, aspectRatio: 2 / 3 })
  expect(portrait).toEqual({ sheetWidthCm: 40, sheetHeightCm: 50 })
  expect(isFixedSheet(portrait)).toBe(true)
})

// Regression: `expanded` and `sheetMode` are keyed by index for unsaved
// rows (`new-<i>`, via keyFor). Deleting a row shifts every later
// sibling's index, and without remapping, a sibling silently inherits the
// deleted row's stale entry — e.g. its "Fixed sheet" mode. remapIndexKeys
// is the single place `remove()` reindexes both maps.
test('remapIndexKeys shifts an index-keyed entry after the removed row down by one', () => {
  const remapped = remapIndexKeys({ 'new-0': 'A', 'new-1': 'B' }, 0, 'new-0')
  expect(remapped).toEqual({ 'new-0': 'B' })
})

test("remapIndexKeys drops the removed row's own entry", () => {
  const remapped = remapIndexKeys({ 'new-0': 'A', 'new-1': 'B', 'new-2': 'C' }, 1, 'new-1')
  expect(remapped).toEqual({ 'new-0': 'A', 'new-1': 'C' })
  expect(remapped['new-1']).not.toBe('B')
})

test('remapIndexKeys leaves entries before the removed row untouched', () => {
  const remapped = remapIndexKeys(
    { 'new-0': 'A', 'new-1': 'B', 'new-2': 'C', 'new-3': 'D' },
    2,
    'new-2',
  )
  expect(remapped['new-0']).toBe('A')
  expect(remapped['new-1']).toBe('B')
})

test('remapIndexKeys passes real-id keys through unchanged', () => {
  const remapped = remapIndexKeys({ abc123: true, 'new-0': false }, 0, 'new-0')
  expect(remapped).toEqual({ abc123: true })
})

// The reported reproduction: A (new-0, fixed) and B (new-1, adaptive).
// Delete A — B must end up keyed new-0 with ITS OWN value, not A's stale
// one, and a saved sibling's id-key must survive the same removal intact.
test('remapIndexKeys handles a mix of id-keyed and index-keyed entries on delete', () => {
  const state = { 'new-0': true, 'new-1': false, savedVariantId: true }
  const remapped = remapIndexKeys(state, 0, 'new-0')
  expect(remapped).toEqual({ 'new-0': false, savedVariantId: true })
})

// A 3:2 artwork and a 4:3 artwork — the ratio mismatch that used to hide every
// template from the picker, including fixed-sheet ones it could never affect.
const THREE_TWO = { widthPx: 6000, heightPx: 4000 }
const FOUR_THREE = { widthPx: 4000, heightPx: 3000 }

test('a fixed-sheet template applies to ANY artwork, whatever its ratio', () => {
  const fixed = { sheetWidthCm: 50, sheetHeightCm: 40, sourceWidthPx: 3000, sourceHeightPx: 2000 }
  expect(isVariantTemplateApplicable(fixed, THREE_TWO)).toBe(true)
  expect(isVariantTemplateApplicable(fixed, FOUR_THREE)).toBe(true)
})

test('an adaptive template still requires an exact ratio match', () => {
  const adaptive = {
    sheetWidthCm: null,
    sheetHeightCm: null,
    sourceWidthPx: 3000,
    sourceHeightPx: 2000,
  }
  // Same 3:2 shape at a different resolution — still applies.
  expect(isVariantTemplateApplicable(adaptive, THREE_TWO)).toBe(true)
  // Different shape — the print size it carries would misdescribe the margins.
  expect(isVariantTemplateApplicable(adaptive, FOUR_THREE)).toBe(false)
})

test('an adaptive template with unknown source pixels is never offered', () => {
  expect(
    isVariantTemplateApplicable(
      { sheetWidthCm: null, sheetHeightCm: null, sourceWidthPx: null, sourceHeightPx: null },
      THREE_TWO,
    ),
  ).toBe(false)
})

/**
 * Template dedup — reported 2026-08-21: the "Apply saved variant" picker
 * listed the SAME 40x50 Baryta template twice, once "from Passeur" and once
 * "from High Res". Both rows were one authored template; the old key included
 * widthCm/heightCm, which for a FIXED SHEET is the image derived per source
 * artwork, so two ratios produced two keys.
 */
const BARYTA_40x50 = {
  name: '40x50 Baryta',
  paperId: 'canson-baryta-gloss',
  borderCm: 7,
  editionSize: 100,
  sheetWidthCm: 50,
  sheetHeightCm: 40,
}

test('one fixed-sheet template stored on differently-shaped artworks dedupes to one', () => {
  // Same authored sheet + border; the derived image differs per source ratio.
  const onThreeTwo = { ...BARYTA_40x50, widthCm: 36, heightCm: 24.2 }
  const onSomethingElse = { ...BARYTA_40x50, widthCm: 36, heightCm: 24.3689583077112 }
  expect(variantTemplateKey(onThreeTwo)).toBe(variantTemplateKey(onSomethingElse))
})

test('fixed-sheet templates with genuinely different sheets stay separate', () => {
  const a = { ...BARYTA_40x50, widthCm: 36, heightCm: 24.2 }
  const b = { ...BARYTA_40x50, sheetHeightCm: 30, sheetWidthCm: 40, widthCm: 26, heightCm: 17.5 }
  expect(variantTemplateKey(a)).not.toBe(variantTemplateKey(b))
})

test('a different border or edition size is a different template', () => {
  const base = { ...BARYTA_40x50, widthCm: 36, heightCm: 24.2 }
  expect(variantTemplateKey(base)).not.toBe(variantTemplateKey({ ...base, borderCm: 5 }))
  expect(variantTemplateKey(base)).not.toBe(variantTemplateKey({ ...base, editionSize: 50 }))
  expect(variantTemplateKey(base)).not.toBe(variantTemplateKey({ ...base, name: 'Other' }))
})

test('ADAPTIVE templates are still identified by their authored print size', () => {
  // No sheet — widthCm/heightCm are what the artist set, so they must count.
  const a = { ...BARYTA_40x50, sheetWidthCm: null, sheetHeightCm: null, widthCm: 36, heightCm: 24 }
  const b = { ...a, widthCm: 30, heightCm: 20 }
  expect(variantTemplateKey(a)).not.toBe(variantTemplateKey(b))
  expect(variantTemplateKey(a)).toBe(variantTemplateKey({ ...a }))
})

test('a fixed-sheet and an adaptive template never collide', () => {
  const fixed = { ...BARYTA_40x50, widthCm: 36, heightCm: 24.2 }
  const adaptive = { ...fixed, sheetWidthCm: null, sheetHeightCm: null }
  expect(variantTemplateKey(fixed)).not.toBe(variantTemplateKey(adaptive))
})
