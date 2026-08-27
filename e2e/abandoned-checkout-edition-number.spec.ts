import { test, expect } from '@playwright/test'

import {
  createCartPaymentIntent,
  type CartCheckoutItem,
} from '@/components/checkout/CartCheckout/createCartPaymentIntent'
import prisma from '@/lib/prisma'

import { editionNumberStates, setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { cancelPaymentIntent, fixtureAddress } from './stripe-helpers'

/**
 * An ABANDONED checkout must not consume an edition number.
 *
 * A number moves to `reserved` the instant a PaymentIntent is created, and it
 * is released again when that intent dies. Only the Stripe webhook marks a copy
 * `sold`. So a visitor who reaches payment and walks away has bought nothing,
 * and the edition on the artwork page must not have moved.
 *
 * This is a REGRESSION test for a real defect: the page read the lowest
 * AVAILABLE number, which skipped reserved copies, so two abandoned attempts
 * advanced a live edition from "2 of 50" to "4 of 50" with nothing sold. The
 * unit-level test that existed only ever moved numbers between `available` and
 * `sold` — it never produced a `reserved` one, so it could not fail.
 *
 * The figure now reports copies SOLD, so an abandoned checkout cannot touch it.
 *
 * Deliberately drives the REAL reservation path rather than writing states by
 * hand: writing `reserved` directly would prove only that the query filters a
 * string, not that abandoning a genuine checkout is harmless.
 *
 * Flat page, no WebGL. The PaymentIntent is never confirmed — that IS the
 * abandonment — and is cancelled in teardown so no hold is left on Stripe.
 */
test.describe('an abandoned checkout', () => {
  test('reserves a number without advancing the edition on the page', async ({ page }) => {
    const fx = await setupLimitedFixture(50)
    const abandoned: string[] = []
    try {
      // Two copies genuinely sold — the edition stands at 2 of 50.
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: { in: [1, 2] } },
        data: { state: 'sold' },
      })

      await page.goto(`/artworks/${fx.slug}`)
      await expect(page.getByText(/Edition of 50/).first()).toBeVisible()

      // Two visitors reach payment and leave. Real reservations, real Stripe
      // intents, no confirmation.
      for (const tag of ['abandon-a', 'abandon-b']) {
        const line: CartCheckoutItem = {
          lineId: `e2e-abandon-${tag}`,
          artworkSlug: fx.slug,
          providerId: 'printspace',
          config: { values: {} },
          variantId: fx.variantId,
          editionType: 'limited',
          quantity: 1,
          editionNumberIds: [],
        }
        const intent = await createCartPaymentIntent({
          items: [line],
          address: fixtureAddress(tag, { email: `${tag}@example.com` }),
        })
        expect(intent.ok, 'the reservation itself must succeed').toBe(true)
        if (intent.ok) abandoned.push(intent.paymentIntentId)
      }

      // The ledger did its job: two copies are held, none sold.
      const states = await editionNumberStates(fx.variantId)
      expect(states.filter((s) => s.state === 'reserved')).toHaveLength(2)
      expect(states.filter((s) => s.state === 'sold')).toHaveLength(2)

      // The page must not have moved. This is the assertion that failed in
      // production: it read 5 of 50 because two held copies had been skipped.
      await page.goto(`/artworks/${fx.slug}`)
      await expect(
        page.getByText(/Edition of 50/).first(),
        'an unpaid reservation must not change what the page states',
      ).toBeVisible()
      // No copy number of any kind: the row promises nothing a checkout could
      // falsify, which is the whole point of stating only the size.
      await expect(page.locator('body')).not.toContainText(/\d+ of 50/)
    } finally {
      for (const id of abandoned) await cancelPaymentIntent(id).catch(() => {})
      await teardownLimitedFixture(fx)
    }
  })
})
