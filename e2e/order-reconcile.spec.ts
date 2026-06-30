import { test, expect } from '@playwright/test'

import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
import prisma from '@/lib/prisma'

import { deletePrintOrderByPaymentIntent, waitForPrintOrderByPaymentIntent } from './cleanup-helpers'
import { editionNumberStates, setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { authorizeLimitedCartPI, backdateReservation, hitReconcileCron } from './order-helpers'
import { cancelPaymentIntent } from './stripe-helpers'

/**
 * Layer-3 reconcile cron — the safety net that makes order creation independent
 * of the Stripe webhook even after the buyer has left the confirmation page.
 *
 * Two behaviours, driven through the REAL `/api/cron/reconcile-orders` route:
 *   A. RECOVER — an authorized PI with no PrintOrder gets one created (idempotent
 *      `ensureOrderForPaymentIntent`), with its reserved edition number bound.
 *   B. RELEASE — a reservation whose PI has died (canceled/abandoned) and was
 *      never bound to an order is freed back to `available`, closing the
 *      orphaned-reservation leak ([[project_guaranteed_order_capture]] Layer 3).
 *
 * Orders are created INSIDE the dev server (where SKIP_EMAILS is set), so no real
 * email is sent ([[feedback_no_emails_in_e2e]]). CRON_SECRET is pinned + injected
 * by playwright.config.
 */
test.describe('reconcile-orders cron — recover + release', () => {
  test('recovers an orphan cart order: authorized PI with no order gets one, number bound', async ({
    request,
  }) => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      const authed = await authorizeLimitedCartPI(fixture, { tag: 'reconcile-recover' })
      paymentIntentId = authed.paymentIntentId

      // No `stripe listen` in e2e and we never called the builder — so the card is
      // held with NO order. This is the exact silent-webhook-failure state.
      const before = await prisma.printOrder.findUnique({
        where: { paymentIntentId },
        select: { id: true },
      })
      expect(before, 'no order should exist before the cron runs').toBeNull()

      // minAgeMinutes=0 so the fresh PI isn't skipped as "too young".
      const { status, body } = await hitReconcileCron(request, { minAgeMinutes: 0 })
      expect(status, 'authorized cron call should succeed').toBe(200)
      // >=1 (not ==1): a shared dev DB may carry other authorized orphans; the
      // order-exists + number-bound asserts below pin recovery to THIS PI.
      expect(
        body.recovered as number,
        'the cron should report at least one recovered order',
      ).toBeGreaterThanOrEqual(1)

      // The order now exists and the edition number is bound (full path ran).
      const order = await waitForPrintOrderByPaymentIntent(paymentIntentId)
      expect(order, 'the cron must have created the PrintOrder').not.toBeNull()

      const taken = (await editionNumberStates(fixture.variantId)).filter(
        (s) => s.state !== 'available',
      )
      expect(taken, 'exactly one number taken by the recovered order').toHaveLength(1)
      expect(taken[0].number).toBe(1)
      expect(taken[0].paymentIntentId).toBe(paymentIntentId)
    } finally {
      if (paymentIntentId) {
        await cancelPaymentIntent(paymentIntentId)
        await releaseEditionNumberForPaymentIntent(paymentIntentId, { allowSold: true })
        await deletePrintOrderByPaymentIntent(paymentIntentId)
      }
      await teardownLimitedFixture(fixture)
    }
  })

  test('releases an orphan reservation: a stuck number whose PI was canceled returns to available', async ({
    request,
  }) => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      // Reserve number 1 + attach a PI, but never create an order — the leak's
      // starting state.
      const authed = await authorizeLimitedCartPI(fixture, { tag: 'reconcile-release' })
      paymentIntentId = authed.paymentIntentId

      const reservedBefore = (await editionNumberStates(fixture.variantId)).filter(
        (s) => s.paymentIntentId === paymentIntentId,
      )
      expect(reservedBefore, 'one number reserved against the PI').toHaveLength(1)
      expect(reservedBefore[0].state).toBe('reserved')

      // The PI dies (auth-hold expiry / buyer abandons) and — crucially — the
      // webhook that would release the number never fires. Backdate the
      // reservation past the cutoff so it's no longer treated as in-flight.
      await cancelPaymentIntent(paymentIntentId)
      await backdateReservation(paymentIntentId)

      const { status, body } = await hitReconcileCron(request, { minAgeMinutes: 0 })
      expect(status).toBe(200)
      expect(
        body.reservationsReleased as number,
        'the cron should release at least one orphan reservation',
      ).toBeGreaterThanOrEqual(1)

      // The number is back in the pool: available, no PI, no order.
      const after = await prisma.editionNumber.findFirst({
        where: { variantId: fixture.variantId, number: 1 },
        select: { state: true, paymentIntentId: true, orderId: true },
      })
      expect(after?.state, 'released number is available again').toBe('available')
      expect(after?.paymentIntentId, 'released number has no PI').toBeNull()
      expect(after?.orderId, 'released number has no order').toBeNull()

      // It must NOT have been recovered into an order (the PI is dead).
      const order = await prisma.printOrder.findUnique({
        where: { paymentIntentId },
        select: { id: true },
      })
      expect(order, 'a canceled PI must not be recovered into an order').toBeNull()
    } finally {
      if (paymentIntentId) {
        await releaseEditionNumberForPaymentIntent(paymentIntentId, { allowSold: true })
        await deletePrintOrderByPaymentIntent(paymentIntentId)
      }
      await teardownLimitedFixture(fixture)
    }
  })

  test('recovery is idempotent: running the cron twice leaves exactly one order', async ({
    request,
  }) => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      const authed = await authorizeLimitedCartPI(fixture, { tag: 'reconcile-idempotent' })
      paymentIntentId = authed.paymentIntentId

      const first = await hitReconcileCron(request, { minAgeMinutes: 0 })
      expect(first.status).toBe(200)
      await waitForPrintOrderByPaymentIntent(paymentIntentId)

      // Second pass: the order now exists, so it's no longer an orphan — no
      // duplicate created.
      const second = await hitReconcileCron(request, { minAgeMinutes: 0 })
      expect(second.status).toBe(200)

      const orders = await prisma.printOrder.findMany({
        where: { paymentIntentId },
        select: { id: true },
      })
      expect(orders, 'exactly one order after two cron runs').toHaveLength(1)
    } finally {
      if (paymentIntentId) {
        await cancelPaymentIntent(paymentIntentId)
        await releaseEditionNumberForPaymentIntent(paymentIntentId, { allowSold: true })
        await deletePrintOrderByPaymentIntent(paymentIntentId)
      }
      await teardownLimitedFixture(fixture)
    }
  })

  test('leaves an in-flight reservation alone: a fresh hold within the cutoff is untouched', async ({
    request,
  }) => {
    test.setTimeout(120_000)

    const fixture = await setupLimitedFixture(30)
    let paymentIntentId: string | null = null
    try {
      // Fresh authorized PI; reservation made just now (NOT backdated).
      const authed = await authorizeLimitedCartPI(fixture, { tag: 'reconcile-inflight' })
      paymentIntentId = authed.paymentIntentId

      // DEFAULT min-age (no override): phase A skips the too-young PI, phase B
      // skips the within-cutoff reservation. A genuine in-flight checkout.
      const { status } = await hitReconcileCron(request)
      expect(status).toBe(200)

      // The number must be wholly untouched: still reserved, PI attached, and
      // NOT bound. Cart orders bind via orderItemId (orderId stays null even when
      // bound), so assert orderItemId — and assert no order exists at all.
      const row = await prisma.editionNumber.findFirst({
        where: { paymentIntentId },
        select: { state: true, paymentIntentId: true, orderId: true, orderItemId: true },
      })
      expect(row?.state, 'in-flight reservation stays reserved').toBe('reserved')
      expect(row?.paymentIntentId, 'in-flight reservation keeps its PI').toBe(paymentIntentId)
      expect(row?.orderItemId, 'in-flight number must NOT be bound to an order item').toBeNull()
      expect(row?.orderId, 'in-flight number must NOT be bound to an order').toBeNull()

      const order = await prisma.printOrder.findUnique({
        where: { paymentIntentId },
        select: { id: true },
      })
      expect(order, 'the default min-age must skip a fresh PI — no order created').toBeNull()
    } finally {
      if (paymentIntentId) {
        await cancelPaymentIntent(paymentIntentId)
        await releaseEditionNumberForPaymentIntent(paymentIntentId, { allowSold: true })
        await deletePrintOrderByPaymentIntent(paymentIntentId)
      }
      await teardownLimitedFixture(fixture)
    }
  })

  test('rejects unauthorized callers: missing and wrong Bearer both 401', async ({ request }) => {
    const noSecret = await hitReconcileCron(request, { secret: null })
    expect(noSecret.status, 'no Bearer → 401').toBe(401)

    const wrongSecret = await hitReconcileCron(request, { secret: 'not-the-cron-secret' })
    expect(wrongSecret.status, 'wrong Bearer → 401').toBe(401)
  })
})
