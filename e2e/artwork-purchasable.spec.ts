import { test, expect } from '@playwright/test'

import { isArtworkPurchasable, isEditionSoldOut } from '../src/lib/editions/printable'

/**
 * The rule every "can they buy this?" surface must ask, rather than checking
 * `printPriceCents` for itself.
 *
 * A limited edition carries NO artwork-level price — it is priced per variant.
 * Surfaces that gated on the price alone hid live, buyable work: first the
 * catalog and the wizard (fixed 2026-08-21), and then, still missed, the
 * artwork's own detail page and the in-exhibition modal — the two places a
 * buyer is most likely to be standing when they decide to buy.
 */
const LIMITED_LIVE = {
  printEnabled: true,
  editionType: 'limited',
  printPriceCents: null,
  liveVariantCount: 2,
}

test('a limited edition with live variants is buyable despite a null artwork price', () => {
  expect(isArtworkPurchasable(LIMITED_LIVE)).toBe(true)
})

test('a limited edition with no live variant is not buyable', () => {
  // Every variant unpublished, unblocked (paused mid-edit), or unpriced.
  expect(isArtworkPurchasable({ ...LIMITED_LIVE, liveVariantCount: 0 })).toBe(false)
})

test('an open edition still turns on the artwork price alone', () => {
  const open = { printEnabled: true, editionType: 'open', liveVariantCount: 0 }
  expect(isArtworkPurchasable({ ...open, printPriceCents: 12000 })).toBe(true)
  expect(isArtworkPurchasable({ ...open, printPriceCents: null })).toBe(false)
})

test('prints switched off beats everything else', () => {
  expect(isArtworkPurchasable({ ...LIMITED_LIVE, printEnabled: false })).toBe(false)
})

/**
 * Sold out is a different state from unpurchasable, and the page must tell them
 * apart. LIVE_VARIANT_WHERE says nothing about remaining stock, so a fully sold
 * edition still counts as "live" — which is exactly how an Order Print button
 * survived on top of a wizard that refuses the sale.
 */
test('a limited edition with live variants but no numbers left is sold out', () => {
  expect(isEditionSoldOut({ ...LIMITED_LIVE, availableNumberCount: 0 })).toBe(true)
  expect(isEditionSoldOut({ ...LIMITED_LIVE, availableNumberCount: 1 })).toBe(false)
})

test('sold out and unpurchasable are not the same answer', () => {
  const soldOut = { ...LIMITED_LIVE, availableNumberCount: 0 }
  // Still purchasable by the catalogue's rule — published, priced, blocked —
  // which is precisely why the sold-out check has to exist alongside it.
  expect(isArtworkPurchasable(soldOut)).toBe(true)
  expect(isEditionSoldOut(soldOut)).toBe(true)
})

test('an open edition never reads as sold out', () => {
  expect(
    isEditionSoldOut({ editionType: 'open', liveVariantCount: 0, availableNumberCount: 0 }),
  ).toBe(false)
})

test('an artwork with no live variants is unpurchasable, not sold out', () => {
  // Nothing was ever on sale — saying "Sold out" would invent a history.
  const noVariants = { ...LIMITED_LIVE, liveVariantCount: 0, availableNumberCount: 0 }
  expect(isEditionSoldOut(noVariants)).toBe(false)
  expect(isArtworkPurchasable(noVariants)).toBe(false)
})
