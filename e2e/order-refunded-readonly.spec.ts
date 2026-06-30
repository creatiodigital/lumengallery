import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * A refunded (or canceled) order is TERMINAL and READ-ONLY in the admin: every
 * fulfillment action (capture / mark-in-production / shipped / delivered /
 * cancel) is gone, so you can't advance a refunded order — which would
 * otherwise email the already-refunded buyer "your order is in production".
 * The one exception is "Delete order" (the test-cleanup escape hatch), which
 * stays active in every state.
 *
 * This drives the real admin order page (auth-gated), so it reuses the admin
 * session globalSetup saved. It sets the terminal state directly in the DB
 * rather than through the auth-gated refund UI — the point under test is how
 * the page RENDERS a refunded order, not the refund action itself. (The
 * server-side guards in advanceStage/cancelOrder are defense-in-depth; they
 * can't be called in-process here because of the admin-session gate, so they're
 * covered by typecheck + code review.)
 */
test.describe('Refunded order is read-only in admin', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('hides every fulfillment action but keeps Delete', async ({ page }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'refunded-readonly' })

      // Put it in the exact state Eduardo hit: refunded, but still sitting at
      // the "At TPS" (Placed) fulfillment stage.
      await prisma.printOrder.update({
        where: { id: bought.orderId },
        data: { paymentStatus: 'refunded', fulfillmentStatus: 'Placed' },
      })

      await page.goto(`/admin/orders/${bought.orderId}`)

      // CRITICAL: wait for the client-side detail to finish loading BEFORE
      // asserting any button is absent. The order loads async, so a bare
      // toHaveCount(0) would trivially pass during the loading state (nothing
      // rendered yet) — a false green. "Delete order" is always present once
      // loaded, so it's our "page is ready" anchor.
      await expect(
        page.getByRole('button', { name: 'Delete order' }),
        'Delete stays active in every state (and signals the page has loaded)',
      ).toBeVisible()

      // Now that it's loaded: a refunded order offers NO fulfillment actions.
      await expect(
        page.getByRole('button', { name: 'Mark in production (notify buyer)' }),
        'a refunded order must not offer "mark in production"',
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Cancel order' }),
        'a refunded order must not offer "cancel order"',
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Capture payment' }),
        'a refunded order must not offer "capture payment"',
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Mark placed at TPS' }),
        'a refunded order must not offer "mark placed at TPS"',
      ).toHaveCount(0)
    } finally {
      await teardownBoughtOrder(bought)
    }
  })
})
