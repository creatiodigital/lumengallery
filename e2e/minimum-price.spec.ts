import { test, expect } from '@playwright/test'

import {
  minimumPriceForLimited,
  minimumPriceForOpen,
  minimumPriceForArtwork,
  withVat,
  type LiveVariant,
} from '@/lib/editions/minimumPrice'

/**
 * The number behind a price on a prints card.
 *
 * The rule that matters: whatever is shown must be a price some real
 * configuration produces. The tempting shortcuts are not — the artist's cut is
 * what the ARTIST earns, and artist+gallery is a component of the price, so
 * loose it is useless: measured on real data it read €140 against a genuine
 * minimum of €311. These lock the number to something buyable.
 *
 * Pure functions over the pricing model — no browser, no database.
 */

// 3:2 landscape, big enough to print well past the minimum size.
const LANDSCAPE = { originalWidth: 6000, originalHeight: 4000 }
// 2:3 portrait.
const PORTRAIT = { originalWidth: 4000, originalHeight: 6000 }

const variant = (over: Partial<LiveVariant> = {}): LiveVariant => ({
  name: 'Small',
  paperId: 'hahnemuhle-german-etching',
  printTypeId: 'giclee',
  widthCm: 30,
  heightCm: 20,
  borderCm: 3,
  sheetWidthCm: null,
  sheetHeightCm: null,
  priceCents: 10000,
  ...over,
})

test.describe('minimumPriceForLimited', () => {
  test('picks the CHEAPEST variant, not the first', async () => {
    const res = minimumPriceForLimited([
      variant({ name: 'Medium', widthCm: 45, heightCm: 30, priceCents: 20000 }),
      variant({ name: 'Small', priceCents: 10000 }),
    ])
    expect(res?.basis).toBe('variant')
    if (res?.basis === 'variant') expect(res.variantName).toBe('Small')
  })

  test('is well above artist + gallery — the shortcut that looks right and is not', async () => {
    const res = minimumPriceForLimited([variant({ priceCents: 10000 })])
    // artist €100 + 40% gallery = €140. The real floor adds the print itself
    // and the COA/letter, so anything at or below €140 would be unbuyable.
    expect(res!.cents).toBeGreaterThan(14000)
  })

  test('returns null when nothing is on sale — the SOLD signal', async () => {
    expect(minimumPriceForLimited([])).toBeNull()
  })

  test('ignores a variant with no price rather than treating it as free', async () => {
    expect(minimumPriceForLimited([variant({ priceCents: null })])).toBeNull()
  })

  test('a dearer artist cut always costs the buyer more', async () => {
    const cheap = minimumPriceForLimited([variant({ priceCents: 10000 })])!
    const dear = minimumPriceForLimited([variant({ priceCents: 20000 })])!
    expect(dear.cents).toBeGreaterThan(cheap.cents)
  })

  test('a bigger print of the same edition costs more', async () => {
    const small = minimumPriceForLimited([variant({ widthCm: 30, heightCm: 20 })])!
    const big = minimumPriceForLimited([variant({ widthCm: 90, heightCm: 60 })])!
    expect(big.cents).toBeGreaterThan(small.cents)
  })
})

test.describe('minimumPriceForOpen', () => {
  test('prices the SMALLEST printable size, short edge 20cm, ratio preserved', async () => {
    const res = minimumPriceForOpen({ ...LANDSCAPE, printPriceCents: 20000 })
    expect(res?.basis).toBe('smallest-print')
    // 3:2 landscape → 20cm short edge, 30cm long edge. Not a square 20x20.
    expect(Math.min(res!.widthCm, res!.heightCm)).toBeCloseTo(20, 1)
    expect(Math.max(res!.widthCm, res!.heightCm)).toBeCloseTo(30, 1)
  })

  test('follows the artwork orientation', async () => {
    const res = minimumPriceForOpen({ ...PORTRAIT, printPriceCents: 20000 })
    expect(res!.heightCm).toBeGreaterThan(res!.widthCm)
    expect(res!.widthCm).toBeCloseTo(20, 1)
  })

  test('is a genuine floor: any larger size costs more', async () => {
    const floor = minimumPriceForOpen({ ...LANDSCAPE, printPriceCents: 20000 })!
    // Same artist cut, but priced as a limited variant twice the size.
    const bigger = minimumPriceForLimited([
      variant({ widthCm: floor.widthCm * 2, heightCm: floor.heightCm * 2, priceCents: 20000 }),
    ])!
    expect(bigger.cents).toBeGreaterThan(floor.cents)
  })

  test('is well above artist + gallery', async () => {
    const res = minimumPriceForOpen({ ...LANDSCAPE, printPriceCents: 20000 })!
    expect(res.cents).toBeGreaterThan(28000) // €200 + 40% = €280
  })

  test('returns null without a price or without dimensions', async () => {
    expect(minimumPriceForOpen({ ...LANDSCAPE, printPriceCents: null })).toBeNull()
    expect(
      minimumPriceForOpen({ printPriceCents: 20000, originalWidth: null, originalHeight: null }),
    ).toBeNull()
  })

  test('returns null for an image too small to print at all', async () => {
    expect(
      minimumPriceForOpen({ printPriceCents: 20000, originalWidth: 50, originalHeight: 50 }),
    ).toBeNull()
  })
})

test.describe('minimumPriceForArtwork', () => {
  const base = { ...LANDSCAPE, printEnabled: true, printPriceCents: 20000 }

  test('dispatches on edition type', async () => {
    const open = minimumPriceForArtwork({ ...base, editionType: 'open' })
    expect(open?.basis).toBe('smallest-print')

    const limited = minimumPriceForArtwork({ ...base, editionType: 'limited' }, [variant()])
    expect(limited?.basis).toBe('variant')
  })

  test('a limited edition ignores the artwork-level price entirely', async () => {
    // Limited editions have no artwork price; a stale one must not leak in.
    const withStalePrice = minimumPriceForArtwork(
      { ...base, editionType: 'limited', printPriceCents: 999999 },
      [variant({ priceCents: 10000 })],
    )
    const withoutIt = minimumPriceForArtwork(
      { ...base, editionType: 'limited', printPriceCents: null },
      [variant({ priceCents: 10000 })],
    )
    expect(withStalePrice!.cents).toBe(withoutIt!.cents)
  })

  test('print sales off means no price at all', async () => {
    expect(minimumPriceForArtwork({ ...base, editionType: 'open', printEnabled: false })).toBeNull()
  })

  test('a limited edition with no live variants is null, whatever the artwork says', async () => {
    expect(minimumPriceForArtwork({ ...base, editionType: 'limited' }, [])).toBeNull()
  })
})

test('withVat is a separate presentation step, not baked into the number', async () => {
  expect(withVat(10000, 0.21)).toBe(12100)
  expect(withVat(10000, 0)).toBe(10000)
})
