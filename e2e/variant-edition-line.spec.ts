import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import {
  formatVariantEditionLine,
  getVariantEditionLines,
} from '@/lib/editions/variantEditionLines'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * The edition line on the artwork page.
 *
 * Shape: `Edition` + the variant's own name + the copy the buyer is ABOUT TO
 * GET + `of` + that variant's edition size. It reads forward — "this one becomes
 * yours" — rather than reporting how many have already gone.
 *
 * The number is the lowest still-AVAILABLE copy, never `max(sold) + 1`: a
 * cancelled order returns its number to the pool, so the two diverge and only
 * the minimum available is what the buyer actually receives.
 *
 * Pure function, no DB, no page.
 */
test.describe('formatVariantEditionLine', () => {
  test('an untouched edition offers its first copy', () => {
    expect(
      formatVariantEditionLine({ variantName: '50x40 Baryta', editionSize: 30, nextNumber: 1 }),
    ).toBe('Edition 50x40 Baryta 1 of 30')
  })

  test('a part-sold edition names the copy this buyer would get', () => {
    expect(
      formatVariantEditionLine({ variantName: '50x40 Baryta', editionSize: 30, nextNumber: 4 }),
    ).toBe('Edition 50x40 Baryta 4 of 30')
  })

  test('an exhausted edition says so instead of a number', () => {
    expect(
      formatVariantEditionLine({ variantName: '70x60 Baryta', editionSize: 10, nextNumber: null }),
    ).toBe('Edition 70x60 Baryta Sold out')
  })

  test('a returned number is offered again, below the highest sold', () => {
    // Copy 2 was cancelled and went back to the pool while 3 and 4 stayed sold.
    // `max(sold) + 1` would say 5; the buyer actually receives 2.
    expect(
      formatVariantEditionLine({ variantName: '50x40 Baryta', editionSize: 30, nextNumber: 2 }),
    ).toBe('Edition 50x40 Baryta 2 of 30')
  })
})

test.describe('getVariantEditionLines', () => {
  test('offers the lowest AVAILABLE copy, even when it sits below the highest sold', async () => {
    const fx = await setupLimitedFixture(5)
    const sell = (numbers: number[]) =>
      prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: { in: numbers } },
        data: { state: 'sold' },
      })
    try {
      // Untouched: the buyer gets the first copy.
      let [line] = await getVariantEditionLines(fx.artworkId)
      expect(line.editionSize).toBe(5)
      expect(line.nextNumber).toBe(1)

      // Copies 1-3 sell in order.
      await sell([1, 2, 3])
      ;[line] = await getVariantEditionLines(fx.artworkId)
      expect(line.nextNumber).toBe(4)

      // Copy 2's order is cancelled and its number goes back to the pool. This
      // is the case `max(sold) + 1` gets wrong — it would answer 5, while
      // reserveEditionNumber will actually hand out 2.
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 2 },
        data: { state: 'available' },
      })
      ;[line] = await getVariantEditionLines(fx.artworkId)
      expect(line.nextNumber, 'a returned copy is offered again').toBe(2)

      // Nothing left at all.
      await sell([2, 4, 5])
      ;[line] = await getVariantEditionLines(fx.artworkId)
      expect(line.nextNumber).toBeNull()
      expect(formatVariantEditionLine(line)).toContain('Sold out')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
