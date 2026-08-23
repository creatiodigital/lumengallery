import { test, expect } from '@playwright/test'
import { buildTpsRecipe, formatTpsRecipe } from '../src/lib/editions/tpsRecipe'

test('fixed-sheet recipe reproduces the verified TPS setup', () => {
  const recipe = buildTpsRecipe({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    paperLabel: 'Hahnemühle German Etching',
  })!
  expect(recipe.sheetWidthCm).toBe(50)
  expect(recipe.sheetHeightCm).toBe(40)
  expect(recipe.borderMm).toBe(70)
  expect(recipe.distribution).toBe('Even')
  expect(recipe.expectedImageWidthCm).toBeCloseTo(36, 5)
  expect(recipe.expectedImageHeightCm).toBeCloseTo(24, 5)
  expect(recipe.expectedBorderXCm).toBeCloseTo(7, 5)
  expect(recipe.expectedBorderYCm).toBeCloseTo(8, 5)
})

// The recipe holds the raw conversion; one-decimal rendering happens at the
// formatting boundary and is asserted with the rest of the block below.
test('inches are converted from centimetres', () => {
  const recipe = buildTpsRecipe({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    paperLabel: 'Hahnemühle German Etching',
  })!
  expect(recipe.sheetWidthIn).toBeCloseTo(19.685, 3)
  expect(recipe.sheetHeightIn).toBeCloseTo(15.748, 3)
})

test('adaptive recipe derives the sheet as image plus twice the border', () => {
  const recipe = buildTpsRecipe({
    widthCm: 27.9,
    heightCm: 40,
    borderCm: 3,
    paperLabel: 'Hahnemühle German Etching',
  })!
  expect(recipe.sheetWidthCm).toBeCloseTo(33.9, 5)
  expect(recipe.sheetHeightCm).toBeCloseTo(46, 5)
  expect(recipe.borderMm).toBe(30)
  // A same-shape sheet gives equal borders on both axes.
  expect(recipe.expectedBorderXCm).toBeCloseTo(recipe.expectedBorderYCm, 3)
})

test('formatted output is width-first and explicitly labelled', () => {
  const recipe = buildTpsRecipe({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    paperLabel: 'Hahnemühle German Etching',
  })!
  const text = formatTpsRecipe(recipe, { title: 'Saut de lange 50x40 Standard' })
  expect(text).toContain('W × H')
  expect(text).toContain('50.0 × 40.0 cm')
  expect(text).toContain('19.7 × 15.7 in')
  expect(text).toContain('70 mm')
  expect(text).toContain('Even')
  expect(text).toContain('Add a border')
  expect(text).toContain('Hahnemühle German Etching')
  // The acceptance line the operator checks against the TPS preview.
  expect(text).toContain('36.0 × 24.0 cm')
  expect(text).toContain('7.0')
  expect(text).toContain('8.0')
  // Must NOT print our own H×W order for the TPS fields.
  expect(text).not.toContain('40.0 × 50.0 cm')
})

test('returns null when the geometry is impossible', () => {
  expect(
    buildTpsRecipe({
      widthCm: 10,
      heightCm: 10,
      borderCm: 20,
      sheetWidthCm: 30,
      sheetHeightCm: 30,
      paperLabel: 'Hahnemühle German Etching',
    }),
  ).toBeNull()
})
