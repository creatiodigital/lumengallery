import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'
import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * Capture / place split — the money-safety flow from
 * [[project_capture_tps_money_flow]]: the gallery must CAPTURE the buyer FIRST,
 * then place + pay TPS. So "Capture payment" and "Mark placed at TPS" are TWO
 * separate, ordered admin actions — not one combined click. Capture-first must be
 * the only possible path (you can never place an order you haven't been paid for).
 *
 * Drives the real admin UI (auth-gated actions). Orders are built headlessly and
 * fully torn down — no Playwright order is left on the dashboard
 * ([[feedback_e2e_no_dashboard_noise]]). No buyer email fires at capture or
 * placement, so nothing leaves the suite ([[feedback_no_emails_in_e2e]]).
 */
test.describe('Capture → place split (real admin UI)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('capturing payment charges the buyer but does NOT place the order at TPS', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'capture-step' })

      const before = await prisma.printOrder.findUnique({
        where: { id: bought.orderId },
        select: { paymentStatus: true, fulfillmentStatus: true },
      })
      expect(before?.paymentStatus, 'order starts authorized').toBe('authorized')
      expect(before?.fulfillmentStatus, 'order starts un-placed').toBeNull()

      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${bought.orderId}`)

      await page.getByRole('button', { name: /Capture payment/i }).click()

      // After capture: money is taken (succeeded), the edition number is sold —
      // but the order is NOT yet placed at TPS. Capturing must not advance
      // fulfillment; that's the separate second step.
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: bought!.orderId },
              select: { paymentStatus: true },
            })
            return o?.paymentStatus
          },
          { message: 'capture should mark the payment succeeded', timeout: 15_000 },
        )
        .toBe('succeeded')

      const after = await prisma.printOrder.findUnique({
        where: { id: bought.orderId },
        select: { fulfillmentStatus: true },
      })
      expect(
        after?.fulfillmentStatus,
        'capturing must NOT place the order at TPS — fulfillment stays un-placed',
      ).toBeNull()

      const num = await prisma.editionNumber.findFirst({
        where: { paymentIntentId: bought.paymentIntentId },
        select: { state: true },
      })
      expect(num?.state, 'capture confirms the edition number sold').toBe('sold')
    } finally {
      await teardownBoughtOrder(bought)
    }
  })

  test('marking placed at TPS advances a captured order to Placed (the second, separate step)', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'place-step' })

      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${bought.orderId}`)

      // ① Capture first.
      await page.getByRole('button', { name: /Capture payment/i }).click()
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: bought!.orderId },
              select: { paymentStatus: true },
            })
            return o?.paymentStatus
          },
          { message: 'capture should succeed first', timeout: 15_000 },
        )
        .toBe('succeeded')

      // ② Now — and only now — the place step is available. Clicking it advances
      // the order to Placed without touching Stripe again.
      await page.getByRole('button', { name: /Mark placed at TPS/i }).click()
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: bought!.orderId },
              select: { fulfillmentStatus: true },
            })
            return o?.fulfillmentStatus
          },
          { message: 'placing should advance fulfillment to Placed', timeout: 15_000 },
        )
        .toBe('Placed')
    } finally {
      await teardownBoughtOrder(bought)
    }
  })

  test('a captured-but-unplaced order lands in the "To place at TPS" queue', async ({ page }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'to-place-tab' })

      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${bought.orderId}`)
      await page.getByRole('button', { name: /Capture payment/i }).click()
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: bought!.orderId },
              select: { paymentStatus: true },
            })
            return o?.paymentStatus
          },
          { message: 'capture should succeed', timeout: 15_000 },
        )
        .toBe('succeeded')

      // The captured order must surface in its own queue — NOT "New" (not yet
      // captured) and NOT "Needs attention". This is the admin's "go place these
      // at TPS" to-do list.
      await page.goto('/admin/orders')
      await page.getByRole('tab', { name: /To place at TPS/i }).click()
      await expect(
        page.getByText(bought.address.fullName),
        'the captured order should be listed under "To place at TPS"',
      ).toBeVisible()
    } finally {
      await teardownBoughtOrder(bought)
    }
  })

  test('an un-captured order offers Capture, never Mark-placed (capture-first enforced in the UI)', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'gating' })

      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${bought.orderId}`)

      // Capture is offered (and its presence means the page has loaded — the
      // anchor for the negative assertion below).
      await expect(page.getByRole('button', { name: /Capture payment/i })).toBeVisible()
      // You can NEVER skip straight to placing — no place button before capture.
      await expect(page.getByRole('button', { name: /Mark placed at TPS/i })).toHaveCount(0)
    } finally {
      await teardownBoughtOrder(bought)
    }
  })
})
