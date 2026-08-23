import { test, expect } from '@playwright/test'
import {
  computeSheetLayout,
  isFixedSheet,
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

// Template applicability was REMOVED on 2026-08-22. The picker used to filter
// saved variants by the target artwork's ratio, which in practice offered only
// fixed-sheet ones and silently withheld the rest — an artist with three saved
// variants saw one, with no reason given. Every variant is now listed, deduped
// by name, and a template that does not fit is rejected at save with a sentence
// naming the variant and the reason.

// Template dedup by composite key was REMOVED on 2026-08-22 along with the
// applicability filter: the picker now lists one entry per distinct NAME, which
// is how an artist identifies a variant anyway, and duplicate names are refused
// at save. See saveLimitedVariants.
