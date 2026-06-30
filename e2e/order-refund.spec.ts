import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'
import { getPaymentIntentStatus } from './stripe-helpers'
import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * The refund ACTION end-to-end, through the real admin UI (auth-gated) — not the
 * read-only RENDER of an already-refunded order (that's order-refunded-readonly).
 * This is the money path: clicking "Refund buyer" must, for an AUTHORIZED order,
 * void the Stripe hold, mark the order refunded, AND return the edition number to
 * the pool — the effects buyers and the ledger depend on.
 *
 * It drives refundOrder via the admin order page because the action is gated by
 * requireAdminSession() and can't be called in-process. The order is built
 * headlessly (in-process money path), refunded through the UI, asserted in the
 * DB, then FULLY torn down — no Playwright order is ever left on the dashboard
 * ([[feedback_e2e_no_dashboard_noise]]). Refund emails are bypassed on the dev
 * server ([[feedback_no_emails_in_e2e]]).
 *
 * Single-print's refund branch (captured → Stripe refund + artist transfer
 * reversal) is NOT covered here — it needs a capture step first; a follow-up.
 */
test.describe('Refund action (authorized order) — real admin UI', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('refunding voids the hold, marks the order refunded, and releases the edition number', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      // Fresh limited order, authorized (card held, not captured) — the
      // refundable pre-capture state. Number 1/30 reserved + bound.
      bought = await buyOneLimited({ editionSize: 30, tag: 'refund-action' })

      // Sanity: the order really starts authorized and the number is taken.
      const before = await prisma.printOrder.findUnique({
        where: { id: bought.orderId },
        select: { paymentStatus: true },
      })
      expect(before?.paymentStatus, 'order starts authorized (refundable)').toBe('authorized')
      expect(await getPaymentIntentStatus(bought.paymentIntentId)).toBe('requires_capture')

      // Seed consent BEFORE navigating, else the cookie banner overlays the
      // viewport bottom and silently intercepts the confirm-modal click.
      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${bought.orderId}`)

      // Open the refund panel → enter the audit reason → issue → confirm.
      await page.getByRole('button', { name: /Refund buyer/ }).click()
      await page.getByLabel(/Reason/).fill('e2e refund-action test — releasing the hold')
      await page.getByRole('button', { name: 'Issue refund' }).click()
      await page.getByRole('button', { name: 'Yes, refund buyer' }).click()

      // The action + revalidation are async; poll the DB for the terminal state
      // instead of racing the UI. This is the assertion that fails loudly if
      // refundOrder regresses.
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: bought!.orderId },
              select: { paymentStatus: true },
            })
            return o?.paymentStatus
          },
          { message: 'order should become refunded', timeout: 15_000 },
        )
        .toBe('refunded')

      // 1) Buyer made whole: the authorized hold is voided (PI canceled).
      expect(
        await getPaymentIntentStatus(bought.paymentIntentId),
        'authorized refund cancels the PaymentIntent (releases the hold)',
      ).toBe('canceled')

      // 2) Edition number returned to the pool: available, no PI, not bound.
      const num = await prisma.editionNumber.findFirst({
        where: { variantId: bought.fixture.variantId, number: bought.number },
        select: { state: true, paymentIntentId: true, orderId: true, orderItemId: true },
      })
      expect(num?.state, 'refunded order frees its edition number').toBe('available')
      expect(num?.paymentIntentId, 'released number drops its PI').toBeNull()
      expect(num?.orderItemId, 'released number drops its order-item link').toBeNull()
      expect(num?.orderId, 'released number drops its order link').toBeNull()

      // 3) The refund is recorded in the audit trail.
      const refundEvent = await prisma.printOrderEvent.findFirst({
        where: { orderId: bought.orderId, kind: 'admin_action', message: 'Refund issued' },
        select: { id: true },
      })
      expect(refundEvent, 'a "Refund issued" event is logged for the audit trail').not.toBeNull()
    } finally {
      // ALWAYS clean up — no Playwright order left on the dashboard. Idempotent:
      // safe even though the refund already released the number + canceled the PI.
      await teardownBoughtOrder(bought)
    }
  })
})
