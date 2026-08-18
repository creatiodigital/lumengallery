import { test, expect } from '@playwright/test'

import {
  createCartPaymentIntent,
  type CartCheckoutItem,
} from '@/components/checkout/CartCheckout/createCartPaymentIntent'
import prisma from '@/lib/prisma'

import { editionNumberStates, setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { cancelPaymentIntent, fixtureAddress } from './stripe-helpers'

/**
 * RE-ENTERING checkout with an unchanged cart — i.e. the buyer reloads the
 * payment step, bounces back from 3DS, or double-submits.
 *
 * This is not an exotic path: refreshing the page re-runs
 * createCartPaymentIntent with byte-identical inputs, which is exactly what
 * the idempotency key exists to absorb. The first call reserves a number and
 * binds it to the PI; a naive second call therefore CANNOT re-adopt that
 * number (the candidate filter requires `paymentIntentId: null`) and reserves
 * the next one instead. If any PI parameter is derived from that number, the
 * replay carries different params under the same key and Stripe rejects it
 * with a StripeIdempotencyError — leaving the buyer permanently unable to pay
 * for that cart.
 *
 * In-process money path (no page, no WebGL); throwaway fixture; full teardown
 * of the PI, the PendingCart row and the fixture itself.
 */

/** Delete the staged cart row a checkout leaves behind for the webhook. */
async function deletePendingCart(paymentIntentId: string): Promise<void> {
  try {
    await prisma.pendingCart.deleteMany({ where: { paymentIntentId } })
  } catch (err) {
    console.warn(
      `[e2e cleanup] pendingCart ${paymentIntentId} delete failed:`,
      err instanceof Error ? err.message : err,
    )
  }
}

test.describe('Cart checkout re-entry (unchanged cart)', () => {
  test('a second identical checkout resumes the SAME PaymentIntent instead of failing, and holds exactly one number', async () => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(3)
    // ONE line id for both calls — a reload reuses the cart's own line, it
    // does not mint a new one. This is what makes the idempotency key stable.
    const line: CartCheckoutItem = {
      lineId: 'e2e-retry-line-1',
      artworkSlug: fixture.slug,
      providerId: 'printspace',
      config: { values: {} },
      variantId: fixture.variantId,
      editionType: 'limited',
      quantity: 1,
      // No client-held numbers: the cart's hold has already been consumed by
      // the first call (bound to its PI), so a reload sends nothing adoptable.
      editionNumberIds: [],
    }
    const address = fixtureAddress('retry', { email: 'e2e+retry@example.com' })

    const paymentIntentIds: string[] = []
    try {
      const first = await createCartPaymentIntent({ items: [line], address })
      expect(first.ok, `first checkout should succeed: ${!first.ok && first.error}`).toBe(true)
      if (!first.ok) return
      paymentIntentIds.push(first.paymentIntentId)

      // The reload.
      const second = await createCartPaymentIntent({ items: [line], address })
      expect(
        second.ok,
        `reloading the payment step must not break checkout: ${!second.ok && second.error}`,
      ).toBe(true)
      if (!second.ok) return
      paymentIntentIds.push(second.paymentIntentId)

      expect(
        second.paymentIntentId,
        'the reload resumes the original PaymentIntent (idempotency key intact)',
      ).toBe(first.paymentIntentId)
      expect(second.totals.totalCents, 'the price does not move on reload').toBe(
        first.totals.totalCents,
      )

      // Ledger ground truth: the buyer holds ONE copy, not two. The number the
      // second call reserved as a candidate must have been returned to the pool.
      const ledger = await editionNumberStates(fixture.variantId)
      const taken = ledger.filter((s) => s.state !== 'available')
      expect(taken, 'one reload does not consume a second copy of the edition').toHaveLength(1)
      expect(taken[0].paymentIntentId, "the held copy carries the buyer's PI").toBe(
        first.paymentIntentId,
      )

      // And the staged cart the webhook builds the order from still matches.
      const carts = await prisma.pendingCart.findMany({
        where: { paymentIntentId: first.paymentIntentId },
        select: { items: true },
      })
      expect(carts, 'exactly one PendingCart row for the resumed PI').toHaveLength(1)
      const items = carts[0].items as { editionNumberIds: string[] }[]
      expect(items, 'the staged cart carries the one line').toHaveLength(1)
      expect(
        items[0].editionNumberIds,
        'the staged line carries exactly the one held number',
      ).toHaveLength(1)
    } finally {
      for (const id of new Set(paymentIntentIds)) {
        await cancelPaymentIntent(id)
        await deletePendingCart(id)
      }
      await teardownLimitedFixture(fixture)
    }
  })
})
