import { test, expect } from '@playwright/test'
import { parseIncomingVariants } from '../src/lib/editions/parseIncomingVariants'

// Regression coverage for the sheet-drop bug: `parseIncomingVariants` used
// to whitelist `sheetWidthCm` / `sheetHeightCm` out of the incoming JSON
// entirely, so every save silently wrote null for both — even a variant
// the artist had just set up as fixed-sheet. These specs exercise the pure
// coercion function directly rather than the HTTP route, per
// docs/superpowers/plans/2026-08-17-fixed-sheet-editions.md.

const baseRow = {
  id: 'v1',
  name: 'Small',
  paperId: 'hahnemuhle-photo-rag',
  widthCm: '30',
  heightCm: '20',
  borderCm: '5',
  editionSize: '25',
  priceEuros: '120',
}

test('both sheet fields present as numbers survive', () => {
  const [v] = parseIncomingVariants([{ ...baseRow, sheetWidthCm: 50, sheetHeightCm: 40 }])
  expect(v.sheetWidthCm).toBe(50)
  expect(v.sheetHeightCm).toBe(40)
})

test('both sheet fields present as numeric strings are coerced to numbers', () => {
  // Form inputs arrive as strings — see the comment above parseIncomingVariants.
  const [v] = parseIncomingVariants([{ ...baseRow, sheetWidthCm: '50', sheetHeightCm: '40' }])
  expect(v.sheetWidthCm).toBe(50)
  expect(v.sheetHeightCm).toBe(40)
  expect(typeof v.sheetWidthCm).toBe('number')
  expect(typeof v.sheetHeightCm).toBe('number')
})

test('both sheet fields absent come through as undefined (adaptive mode)', () => {
  const [v] = parseIncomingVariants([{ ...baseRow }])
  expect(v.sheetWidthCm).toBeUndefined()
  expect(v.sheetHeightCm).toBeUndefined()
})

test('null sheet fields come through as undefined', () => {
  const [v] = parseIncomingVariants([{ ...baseRow, sheetWidthCm: null, sheetHeightCm: null }])
  expect(v.sheetWidthCm).toBeUndefined()
  expect(v.sheetHeightCm).toBeUndefined()
})

test('empty-string sheet fields come through as undefined', () => {
  const [v] = parseIncomingVariants([{ ...baseRow, sheetWidthCm: '', sheetHeightCm: '' }])
  expect(v.sheetWidthCm).toBeUndefined()
  expect(v.sheetHeightCm).toBeUndefined()
})

test('zero sheet fields come through as undefined, not 0', () => {
  // Number(null) is 0 — a naive coercion would make this look "set" to a
  // `!= null` check on the server while still failing isFixedSheet, which
  // is exactly the broken half-state this field pair must never produce.
  const [v] = parseIncomingVariants([{ ...baseRow, sheetWidthCm: 0, sheetHeightCm: 0 }])
  expect(v.sheetWidthCm).toBeUndefined()
  expect(v.sheetHeightCm).toBeUndefined()
})

test('NaN-producing sheet fields come through as undefined, not NaN', () => {
  // Number(undefined) is NaN — must not leak through as a non-finite value.
  const [v] = parseIncomingVariants([
    { ...baseRow, sheetWidthCm: 'not-a-number', sheetHeightCm: 'nope' },
  ])
  expect(v.sheetWidthCm).toBeUndefined()
  expect(v.sheetHeightCm).toBeUndefined()
})

test('a negative sheet dimension comes through as undefined', () => {
  const [v] = parseIncomingVariants([{ ...baseRow, sheetWidthCm: -10, sheetHeightCm: 40 }])
  expect(v.sheetWidthCm).toBeUndefined()
  expect(v.sheetHeightCm).toBe(40)
})

test('other fields are unaffected: strings coerced, id/name/paperId passed through', () => {
  const [v] = parseIncomingVariants([{ ...baseRow, sheetWidthCm: 50, sheetHeightCm: 40 }])
  expect(v.id).toBe('v1')
  expect(v.name).toBe('Small')
  expect(v.paperId).toBe('hahnemuhle-photo-rag')
  expect(v.widthCm).toBe(30)
  expect(v.heightCm).toBe(20)
  expect(v.borderCm).toBe(5)
  expect(v.editionSize).toBe(25)
  expect(v.priceCents).toBe(12000)
})

test('missing id (new variant) still comes through as undefined', () => {
  const { id: _id, ...withoutId } = baseRow
  const [v] = parseIncomingVariants([{ ...withoutId, sheetWidthCm: 50, sheetHeightCm: 40 }])
  expect(v.id).toBeUndefined()
})
