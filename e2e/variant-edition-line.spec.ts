import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { getVariantEditionLines, variantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * The edition line on the artwork page.
 *
 * A row is the variant's own name and its edition SIZE. No running count: every
 * count tried here misled, and "X of Y" is the edition-number convention, so a
 * count in that shape reads as "this is copy X" whatever it actually means.
 *
 * The consequence worth testing is that NOTHING a checkout does — reserving,
 * abandoning, even selling — changes this row until the edition is exhausted.
 *
 * Pure function, no DB, no page.
 */
test.describe('variantEditionLineParts', () => {
  const line = (soldOut: boolean, priceCents: number | null = 31200) => ({
    variantName: '50x40 Baryta',
    editionSize: 30,
    soldOut,
    priceCents,
  })

  test('states the edition size, and nothing it cannot stand behind', () => {
    expect(variantEditionLineParts(line(false))).toEqual({
      name: '50x40 Baryta',
      count: 'Edition of 30',
      price: '\u20ac312',
    })
  })

  test('an exhausted edition says so instead', () => {
    expect(variantEditionLineParts(line(true)).count).toBe('Sold out')
  })

  test('an unpriceable variant yields no figure rather than a zero', () => {
    expect(variantEditionLineParts(line(false, null)).price).toBeNull()
  })
})

test.describe('getVariantEditionLines', () => {
  test('an abandoned checkout leaves the row untouched', async () => {
    const fx = await setupLimitedFixture(50)
    try {
      const [before] = await getVariantEditionLines(fx.artworkId)
      expect(variantEditionLineParts(before).count).toBe('Edition of 50')

      // Two visitors reach payment and abandon. A number is reserved the moment
      // a PaymentIntent is created, but NOTHING WAS PAID — only the Stripe
      // webhook marks a copy `sold`.
      //
      // This once moved a live edition from "2 of 50" to "4 of 50" with nothing
      // sold, because the row read the lowest AVAILABLE number and reservations
      // are not available. The row no longer states a copy at all, so there is
      // nothing for an abandoned checkout to move — this proves that, rather
      // than trusting it.
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: { in: [1, 2] } },
        data: { state: 'reserved' },
      })
      const [after] = await getVariantEditionLines(fx.artworkId)
      expect(after.soldOut, 'a held copy is not a sold one').toBe(false)
      expect(variantEditionLineParts(after).count).toBe('Edition of 50')

      // Even a real sale leaves it alone — only exhausting the edition changes it.
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 1 },
        data: { state: 'sold' },
      })
      const [sold] = await getVariantEditionLines(fx.artworkId)
      expect(variantEditionLineParts(sold).count).toBe('Edition of 50')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('is unmoved by sales until the edition is exhausted', async () => {
    const fx = await setupLimitedFixture(5)
    const sell = (numbers: number[]) =>
      prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: { in: numbers } },
        data: { state: 'sold' },
      })
    try {
      let [line] = await getVariantEditionLines(fx.artworkId)
      expect(line.editionSize).toBe(5)
      expect(line.soldOut).toBe(false)

      // Copies sell; the row is unchanged, because it makes no claim about them.
      await sell([1, 2, 3])
      ;[line] = await getVariantEditionLines(fx.artworkId)
      expect(line.soldOut).toBe(false)

      // Copy 2's order is cancelled and its number goes back to the pool. This
      // is the case `max(sold) + 1` gets wrong — it would answer 5, while
      // reserveEditionNumber will actually hand out 2.
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 2 },
        data: { state: 'available' },
      })
      ;[line] = await getVariantEditionLines(fx.artworkId)
      expect(line.soldOut, 'a returned copy is not sold out').toBe(false)

      // Every copy gone — counted, so a gap in the numbering cannot fake it.
      await sell([2, 4, 5])
      ;[line] = await getVariantEditionLines(fx.artworkId)
      expect(line.soldOut).toBe(true)
      expect(variantEditionLineParts(line).count).toBe('Sold out')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
