import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'
import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * Re-order / replacement reprint — the faulty-goods remedy. When a delivered print
 * is damaged/wrong and the buyer wants a reprint (not a refund), the admin
 * "Re-order"s it: the SAME order is reset to step ② "To place at TPS" so the
 * replacement walks the normal pipeline again — WITHOUT re-charging the buyer and
 * WITHOUT touching the edition number (same numbered copy remade). Spec:
 * docs/superpowers/specs/2026-06-26-reorder-reprint-design.md.
 *
 * Drives the real admin UI (auth-gated). The order is built headlessly and its
 * post-delivery state is set directly (the point under test is the re-order, not
 * re-walking the whole pipeline). Fully torn down — no dashboard noise
 * ([[feedback_e2e_no_dashboard_noise]]).
 */
test.describe('Re-order / reprint (real admin UI)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('re-ordering a delivered print resets it to "To place at TPS" — no re-charge, edition kept, reason recorded', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'reorder' })

      // Put it in the captured + delivered state, number sold, with a real shipment.
      await prisma.printOrder.update({
        where: { id: bought.orderId },
        data: {
          paymentStatus: 'succeeded',
          fulfillmentStatus: 'Complete',
          trackingUrl: 'https://track.example/abc',
          shippedAt: new Date(),
        },
      })
      await prisma.editionNumber.updateMany({
        where: { paymentIntentId: bought.paymentIntentId },
        data: { state: 'sold', soldAt: new Date() },
      })

      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${bought.orderId}`)

      await page.getByRole('button', { name: 'Re-order (reprint)' }).click()
      await page.getByLabel(/Reason/i).selectOption('damaged')
      await page.getByRole('button', { name: 'Confirm re-order' }).click()

      // Reset to "To place at TPS": fulfillment cleared, payment still succeeded.
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: bought!.orderId },
              select: { fulfillmentStatus: true },
            })
            return o?.fulfillmentStatus
          },
          { message: 'reorder should reset fulfillment to pending', timeout: 15_000 },
        )
        .toBeNull()

      const o = await prisma.printOrder.findUnique({
        where: { id: bought.orderId },
        select: {
          paymentStatus: true,
          reorderCount: true,
          reorderReason: true,
          trackingUrl: true,
          shippedAt: true,
        },
      })
      expect(o?.paymentStatus, 'NOT re-charged — stays succeeded (no re-capture)').toBe('succeeded')
      expect(o?.reorderCount, 'the reprint is counted').toBe(1)
      expect(o?.reorderReason, 'the reason is recorded').toBe('damaged')
      expect(o?.trackingUrl, 'old tracking cleared for the fresh shipment').toBeNull()
      expect(o?.shippedAt, 'old shipment timestamp cleared').toBeNull()

      const num = await prisma.editionNumber.findFirst({
        where: { paymentIntentId: bought.paymentIntentId },
        select: { state: true },
      })
      expect(num?.state, 'same edition copy remade — number stays sold').toBe('sold')
    } finally {
      await teardownBoughtOrder(bought)
    }
  })

  test('soft cap: from the 3rd reprint it warns but still allows', async ({ page }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'reorder-softcap' })
      // Already reprinted twice → opening the panel must warn.
      await prisma.printOrder.update({
        where: { id: bought.orderId },
        data: { paymentStatus: 'succeeded', fulfillmentStatus: 'Complete', reorderCount: 2 },
      })

      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${bought.orderId}`)
      await page.getByRole('button', { name: 'Re-order (reprint)' }).click()

      await expect(
        page.getByText(/already been reprinted/i),
        'the soft-cap warning shows from the 3rd reprint',
      ).toBeVisible()

      // …but it is NOT blocked — once a reason is chosen, confirm is enabled.
      await page.getByLabel(/Reason/i).selectOption('print_quality')
      await expect(page.getByRole('button', { name: 'Confirm re-order' })).toBeEnabled()
    } finally {
      await teardownBoughtOrder(bought)
    }
  })

  test('a re-ordered order shows the ⟳ Replacement badge in the orders list', async ({ page }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'reorder-badge' })
      // A re-ordered order awaiting re-placement (succeeded + pending) with the marker.
      await prisma.printOrder.update({
        where: { id: bought.orderId },
        data: {
          paymentStatus: 'succeeded',
          fulfillmentStatus: null,
          reorderCount: 1,
          reorderReason: 'damaged',
        },
      })

      await seedCookieConsent(page)
      await page.goto('/admin/orders')
      await page.getByRole('tab', { name: /To place at TPS/i }).click()

      const row = page.getByRole('row', { name: new RegExp(bought.address.fullName) })
      await expect(
        row.getByText(/⟳ Replacement/),
        'the re-ordered order is flagged in the list',
      ).toBeVisible()
    } finally {
      await teardownBoughtOrder(bought)
    }
  })
})
