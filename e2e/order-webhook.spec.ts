import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { deletePrintOrderById, waitForPrintOrderByPaymentIntent } from './cleanup-helpers'
import { editionNumberStates, setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { authorizeLimitedCartPI, deliverSignedStripeEvent } from './order-helpers'
import { cancelPaymentIntent } from './stripe-helpers'

/**
 * Stripe webhook → order creation, through the REAL delivery path.
 *
 * Every other order spec calls the builder (`createPrintOrderFromCart`)
 * DIRECTLY, so it proves the order CONTENTS but is silent on whether a real
 * Stripe event actually produces an order. That blind spot is how a live buy
 * can succeed, the buyer be told "confirmed," and NO order appear — with the
 * whole suite green. This spec closes it: it authorizes a real PI, then POSTs a
 * correctly-signed `amount_capturable_updated` event to the real
 * `/api/webhooks/stripe` route and asserts an order is created. If the route,
 * its event dispatch, signature verification, or the builder regress, this test
 * FAILS instead of going falsely green.
 *
 * Honest limit: no e2e can detect "the dev forgot to run `stripe listen`" —
 * that's a local process, not code. This guards every code path that CAN break;
 * the product fix ([[project_guaranteed_order_capture]]) removes the dependency
 * on the webhook entirely. Order creation here runs INSIDE the dev server (where
 * SKIP_EMAILS is set), so no real email is sent ([[feedback_no_emails_in_e2e]]).
 *
 * Needs Stripe test-mode keys + STRIPE_WEBHOOK_SECRET in .env.local (the test
 * signs with the same secret the route verifies against).
 */
test.describe('Stripe webhook → order creation (real delivery path)', () => {
  test('a correctly-signed amount_capturable_updated event creates the order; nothing exists until it is delivered', async ({
    request,
  }) => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      const authed = await authorizeLimitedCartPI(fixture, { tag: 'webhook-real-path' })
      paymentIntentId = authed.paymentIntentId

      // BEFORE delivery: the card is held, but NO order exists. No `stripe
      // listen` runs in e2e, so nothing has delivered the event — which proves
      // the order below is attributable to OUR signed POST, not the auth.
      const before = await prisma.printOrder.findUnique({
        where: { paymentIntentId },
        select: { id: true },
      })
      expect(before, 'no order should exist until the webhook is delivered').toBeNull()

      // Deliver the REAL signed event to the REAL route.
      const status = await deliverSignedStripeEvent(request, {
        type: 'payment_intent.amount_capturable_updated',
        paymentIntentId,
      })
      expect(status, 'the route should accept a correctly-signed event').toBe(200)

      // AFTER delivery: the order exists. If the route/dispatch/signature/builder
      // is broken, this poll times out and the test FAILS — no more false green.
      const order = await waitForPrintOrderByPaymentIntent(paymentIntentId)
      expect(order, 'the webhook must have created the PrintOrder').not.toBeNull()

      // Full path ran (not just a bare row): the edition number is bound.
      const taken = (await editionNumberStates(fixture.variantId)).filter(
        (s) => s.state !== 'available',
      )
      expect(taken, 'exactly one number taken by the webhook-created order').toHaveLength(1)
      expect(taken[0].number).toBe(1)
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

  test('a badly-signed event is rejected (400) and creates no order — proving the green case is real', async ({
    request,
  }) => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      const authed = await authorizeLimitedCartPI(fixture, { tag: 'webhook-bad-sig' })
      paymentIntentId = authed.paymentIntentId

      // A real-looking event body but a bogus signature header.
      const payload = JSON.stringify({
        id: `evt_e2e_badsig_${paymentIntentId}`,
        object: 'event',
        type: 'payment_intent.amount_capturable_updated',
        data: { object: { id: paymentIntentId, metadata: { kind: 'cart' } } },
      })
      const res = await request.post('/api/webhooks/stripe', {
        headers: { 'stripe-signature': 't=1,v1=deadbeef', 'content-type': 'application/json' },
        data: payload,
      })
      expect(res.status(), 'an unsigned/forged event must be rejected').toBe(400)

      // The rejection means NO order was created — the signature gate works.
      const order = await prisma.printOrder.findUnique({
        where: { paymentIntentId },
        select: { id: true },
      })
      expect(order, 'a rejected event must not create an order').toBeNull()
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
