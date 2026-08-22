import { test, expect } from '@playwright/test'

import { cartedVariantIds, resolveSelectedVariant } from '../src/lib/editions/variantSelection'

/**
 * The limited picker is single-select and always has exactly one edition
 * chosen. A variant
 * already in the cart stays selectable — selecting is how the buyer hangs an
 * edition on the wall in the 3D preview, which they should be able to do again
 * after buying — but it can never be added twice: the cart offers neither an
 * edit nor a second copy of a limited line (see CartLine, where "Edit item" is
 * hidden and the stepper's + is disabled for them).
 *
 * These specs pin those decisions. The picker markup around them is not covered
 * here on purpose: the wizard page mounts the R3F preview, and this suite mounts
 * zero WebGL.
 */

const SMALL = { id: 'v-small' }
const LARGE = { id: 'v-large' }
const AVAILABLE = [SMALL, LARGE]

test('a cart line marks its own variant', () => {
  const ids = cartedVariantIds([{ artworkId: 'art-1', variantId: 'v-small' }], 'art-1')
  expect([...ids]).toEqual(['v-small'])
})

test('another artwork in the cart marks nothing here', () => {
  const ids = cartedVariantIds([{ artworkId: 'art-2', variantId: 'v-small' }], 'art-1')
  expect(ids.size).toBe(0)
})

test('an open-edition line marks nothing — it has no variant', () => {
  const ids = cartedVariantIds([{ artworkId: 'art-1' }], 'art-1')
  expect(ids.size).toBe(0)
})

// On arrival, and on every refresh, the first card in the column is the one
// selected: the preview and the panel beside it have nothing to show otherwise.
test('the wizard opens on the first edition', () => {
  expect(resolveSelectedVariant('', AVAILABLE)).toBe(SMALL)
})

test('a chosen edition is the selected one', () => {
  expect(resolveSelectedVariant('v-large', AVAILABLE)).toBe(LARGE)
})

// Owning a copy is no reason to lose the wall preview, so a carted variant is
// resolved like any other — `cartedVariantIds` only drives the mark and the CTA.
test('a carted edition can still be selected, so it can be seen again', () => {
  expect(resolveSelectedVariant('v-small', AVAILABLE)).toBe(SMALL)
})

// Selling out under a sitting selection must not leave the wizard showing
// nothing — it falls back to the first edition still on sale.
test('a selected edition that sells out falls back to the first', () => {
  expect(resolveSelectedVariant('v-small', [LARGE])).toBe(LARGE)
})

test('a work with nothing on sale selects nothing', () => {
  expect(resolveSelectedVariant('v-small', [])).toBeNull()
})
