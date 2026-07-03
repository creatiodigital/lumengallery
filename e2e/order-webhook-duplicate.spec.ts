import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { deletePrintOrderByPaymentIntent, waitForPrintOrderByPaymentIntent } from './cleanup-helpers'
import { editionNumberStates, setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { authorizeLimitedCartPI, deliverSignedStripeEvent } from './order-helpers'
import { cancelPaymentIntent } from './stripe-helpers'

/**
 * DUPLICATE webhook delivery, through the REAL HTTP route.
 *
 * Stripe delivers events at-least-once: a slow handler response, a redeploy,
 * or an admin "resend" all produce the SAME signed event arriving more than
 * once. order-ensure.spec proves idempotency at the FUNCTION layer; this spec
 * proves it at the WIRE layer — the layer production actually runs — by
 * POSTing the identical correctly-signed `amount_capturable_updated` event to
 * `/api/webhooks/stripe` three times and asserting the world ends up with
 * exactly ONE order, ONE order item, and ONE edition number bound.
 *
 * Every delivery must also be ACKed (200): a non-2xx on a duplicate would
 * make Stripe keep retrying for days ([[project_guaranteed_order_capture]]).
 * Order creation runs inside the dev server where SKIP_EMAILS is set — no
 * real email ([[feedback_no_emails_in_e2e]]). Throwaway fixture, full teardown.
 */
test.describe('Stripe webhook — duplicate delivery is idempotent (real route)', () => {
  test('the same signed event delivered 3× yields exactly one order, one item, one bound number', async ({
    request,
  }) => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      const authed = await authorizeLimitedCartPI(fixture, { tag: 'webhook-duplicate' })
      paymentIntentId = authed.paymentIntentId

      // ── Delivery #1: creates the order. ──────────────────────────────────
      const first = await deliverSignedStripeEvent(request, {
        type: 'payment_intent.amount_capturable_updated',
        paymentIntentId,
      })
      expect(first, 'first delivery is accepted').toBe(200)

      const order = await waitForPrintOrderByPaymentIntent(paymentIntentId)
      expect(order, 'first delivery created the order').not.toBeNull()
      if (!order) throw new Error('unreachable')

      // ── Deliveries #2 and #3: identical event id, identical signature path.
      // Sequential on purpose: this models Stripe's redelivery (which waits
      // for the previous response), and each run traverses the full handler —
      // signature check, dispatch, builder — against an EXISTING order.
      const second = await deliverSignedStripeEvent(request, {
        type: 'payment_intent.amount_capturable_updated',
        paymentIntentId,
      })
      const third = await deliverSignedStripeEvent(request, {
        type: 'payment_intent.amount_capturable_updated',
        paymentIntentId,
      })
      expect(second, 'duplicate delivery must be ACKed, not errored').toBe(200)
      expect(third, 'every redelivery must be ACKed').toBe(200)

      // ── Ground truth: nothing was duplicated. ────────────────────────────
      const orderCount = await prisma.printOrder.count({ where: { paymentIntentId } })
      expect(orderCount, 'exactly ONE order for the PI').toBe(1)

      const itemCount = await prisma.printOrderItem.count({ where: { orderId: order.id } })
      expect(itemCount, 'exactly ONE order item — replays did not re-append lines').toBe(1)

      const taken = (await editionNumberStates(fixture.variantId)).filter(
        (s) => s.state !== 'available',
      )
      expect(taken, 'exactly ONE edition number taken across all deliveries').toHaveLength(1)
      expect(taken[0].number, 'and it is the lowest, 1').toBe(1)
      expect(taken[0].paymentIntentId, 'bound to this PI').toBe(paymentIntentId)

      // The order's money was not mutated by the replays: it still matches the
      // server-authoritative total the checkout quoted.
      const stored = await prisma.printOrder.findUnique({
        where: { id: order.id },
        select: { totalCents: true },
      })
      expect(stored?.totalCents, 'order total unchanged by redeliveries').toBe(authed.totalCents)
    } finally {
      if (paymentIntentId) {
        await cancelPaymentIntent(paymentIntentId)
        await deletePrintOrderByPaymentIntent(paymentIntentId)
      }
      await teardownLimitedFixture(fixture)
    }
  })
})
