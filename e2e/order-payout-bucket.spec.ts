import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'
import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * Orders-list payout bucketing for CART orders. Cart orders pay each artist
 * PER ITEM (PrintOrderItem.paidOutAt); the order header's paidOutAt is never
 * stamped. The list's bucket + payout column must therefore read per-item payout
 * state — matching the detail page — or a fully-paid cart order gets stranded in
 * "Delivered" instead of moving to "Artist paid". Regression guard for that bug
 * (found 2026-06-28).
 */
test.describe('Orders list — payout bucketing (cart)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('a delivered cart order whose item is paid lands in "Artist paid", not "Delivered"', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'payout-bucket' })
      await prisma.printOrder.update({
        where: { id: bought.orderId },
        data: { paymentStatus: 'succeeded', fulfillmentStatus: 'Complete' },
      })
      // Pay the (only) cart line manually — per-item payout; header stays null.
      await prisma.printOrderItem.updateMany({
        where: { orderId: bought.orderId },
        data: { paidOutAt: new Date(), transferStatus: 'paid_manual' },
      })

      await seedCookieConsent(page)
      await page.goto('/admin/orders')

      // It belongs under "Artist paid" …
      await page.getByRole('tab', { name: /Artist paid/i }).click()
      await expect(
        page.getByRole('row', { name: new RegExp(bought.address.fullName) }),
        'a fully-paid cart order should be in the Artist paid tab',
      ).toBeVisible()

      // … and NOT still under "Delivered".
      await page.getByRole('tab', { name: /^Delivered/i }).click()
      await expect(
        page.getByRole('row', { name: new RegExp(bought.address.fullName) }),
        'a paid order must leave the Delivered tab',
      ).toHaveCount(0)
    } finally {
      await teardownBoughtOrder(bought)
    }
  })
})
