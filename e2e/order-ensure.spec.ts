import { test, expect } from '@playwright/test'

import { ensureOrderForPaymentIntent } from '@/lib/orders/ensureOrderForPaymentIntent'
import prisma from '@/lib/prisma'

import { deletePrintOrderById } from './cleanup-helpers'
import { editionNumberStates, setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { authorizeLimitedCartPI } from './order-helpers'
import { cancelPaymentIntent } from './stripe-helpers'

/**
 * ensureOrderForPaymentIntent — the confirmation-side guarantee.
 *
 * The webhook is no longer the ONLY thing that creates an order: the buyer
 * confirmation step calls this to create the order synchronously (idempotently)
 * if the webhook hasn't. That makes "authorized PaymentIntent in Stripe ⟹
 * PrintOrder in the dashboard" hold even when the webhook never fires (the
 * exact incident: forwarder down). These specs drive it directly, the same way
 * the confirmation step will.
 *
 * Headless; needs Stripe test-mode keys + the synced DB. Order creation runs
 * in-process, so SKIP_EMAILS must be set on the runner (it is, by config) —
 * see [[feedback_no_emails_in_e2e]].
 */
test.describe('ensureOrderForPaymentIntent — confirmation-side guarantee', () => {
  test('creates the order for an authorized PI that has none yet (Stripe ⟹ DB)', async () => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      paymentIntentId = (await authorizeLimitedCartPI(fixture, { tag: 'ensure-create' }))
        .paymentIntentId

      // Authorized in Stripe, but nothing has created the order (no webhook in
      // e2e) — exactly the state the guarantee must close.
      expect(
        await prisma.printOrder.findUnique({
          where: { paymentIntentId },
          select: { id: true },
        }),
        'no order should exist before ensure',
      ).toBeNull()

      const res = await ensureOrderForPaymentIntent(paymentIntentId)
      expect(res.ok, res.ok ? '' : `ensure failed: ${!res.ok && res.error}`).toBe(true)

      const order = await prisma.printOrder.findUnique({
        where: { paymentIntentId },
        select: { id: true },
      })
      expect(order, 'order must exist after ensure').not.toBeNull()
      if (res.ok) {
        expect(res.orderId).toBe(order!.id)
        expect(res.created, 'this call created it').toBe(true)
      }

      // Full path ran: the edition number is bound.
      const taken = (await editionNumberStates(fixture.variantId)).filter(
        (s) => s.state !== 'available',
      )
      expect(taken, 'exactly one number taken by the ensured order').toHaveLength(1)
    } finally {
      if (paymentIntentId) {
        await cancelPaymentIntent(paymentIntentId)
        const o = await prisma.printOrder.findUnique({
          where: { paymentIntentId },
          select: { id: true },
        })
        if (o) await deletePrintOrderById(o.id)
      }
      await teardownLimitedFixture(fixture)
    }
  })

  test('is idempotent — calling twice (confirmation + webhook race) yields ONE order', async () => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      paymentIntentId = (await authorizeLimitedCartPI(fixture, { tag: 'ensure-idem' }))
        .paymentIntentId

      const first = await ensureOrderForPaymentIntent(paymentIntentId)
      const second = await ensureOrderForPaymentIntent(paymentIntentId)

      expect(first.ok && second.ok, 'both calls succeed').toBe(true)
      if (first.ok && second.ok) {
        expect(second.orderId, 'same order both times').toBe(first.orderId)
        expect(first.created, 'first call created it').toBe(true)
        expect(second.created, 'second call found the existing one').toBe(false)
      }

      // Exactly ONE order + ONE number — no duplicate from the second call.
      expect(
        await prisma.printOrder.count({ where: { paymentIntentId } }),
        'exactly one order row',
      ).toBe(1)
      const taken = (await editionNumberStates(fixture.variantId)).filter(
        (s) => s.state !== 'available',
      )
      expect(taken, 'no duplicate number reservation').toHaveLength(1)
    } finally {
      if (paymentIntentId) {
        await cancelPaymentIntent(paymentIntentId)
        const o = await prisma.printOrder.findUnique({
          where: { paymentIntentId },
          select: { id: true },
        })
        if (o) await deletePrintOrderById(o.id)
      }
      await teardownLimitedFixture(fixture)
    }
  })
})
