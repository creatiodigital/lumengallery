import { test, expect } from '@playwright/test'

import { formatOrderRef, orderMatchesQuery } from '@/lib/orders/orderRef'

import { seedCookieConsent } from './consent-helpers'
import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * ONE reference per order, everywhere.
 *
 * The confirmation screen used to print the raw Stripe PaymentIntent id while
 * every email printed the 8-character order reference — and three email
 * templates printed it lowercase. A buyer therefore held up to three different
 * names for one purchase and no way to know which to quote, and the admin had
 * no search box to look any of them up.
 */
test.describe('Order reference', () => {
  test('formatOrderRef is stable, uppercase and 8 characters', () => {
    expect(formatOrderRef('ad81e642-9f3c-4a1b-8e77-2b7d5c9a1234')).toBe('AD81E642')
    // Already-uppercase input must not change shape — the same order can't
    // answer to two names depending on where the id came from.
    expect(formatOrderRef('AD81E642-9f3c-4a1b-8e77-2b7d5c9a1234')).toBe('AD81E642')
  })

  test('admin search matches a reference, a payment id, a buyer and an artwork', () => {
    const order = {
      id: 'ad81e642-9f3c-4a1b-8e77-2b7d5c9a1234',
      paymentIntentId: 'pi_3U5pTsAg9UtngdaC0Bgexaqd',
      buyerName: 'Thomas Heizmann',
      buyerEmail: 'thomas@example.com',
      artwork: { title: 'Puerta Azul' },
    }

    // What a buyer quotes from their email…
    expect(orderMatchesQuery(order, 'AD81E642')).toBe(true)
    expect(orderMatchesQuery(order, 'ad81e642')).toBe(true)
    // …with the "#" the admin used to print…
    expect(orderMatchesQuery(order, '#AD81E642')).toBe(true)
    // …what they might quote from the old confirmation screen…
    expect(orderMatchesQuery(order, 'pi_3U5pTsAg9UtngdaC0Bgexaqd')).toBe(true)
    // …and the things you actually remember about a customer.
    expect(orderMatchesQuery(order, 'heizmann')).toBe(true)
    expect(orderMatchesQuery(order, 'thomas@example.com')).toBe(true)
    expect(orderMatchesQuery(order, 'puerta')).toBe(true)

    expect(orderMatchesQuery(order, 'ZZZZZZZZ')).toBe(false)
    // Empty query must not hide the list.
    expect(orderMatchesQuery(order, '   ')).toBe(true)
  })

  test('the confirmation screen shows the order reference, not the payment id', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited(1)
      const ref = formatOrderRef(bought.orderId)

      await seedCookieConsent(page)
      await page.goto(`/checkout?payment_intent=${bought.paymentIntentId}`)
      await expect(page.getByText(/your order is confirmed/i)).toBeVisible({ timeout: 30_000 })

      // Dismiss the unboxing request so it can't cover the reference block.
      const dialog = page.getByRole('dialog')
      if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Got it' }).click()

      await expect(
        page.getByText(ref, { exact: false }),
        'the buyer sees the same reference their emails and invoice carry',
      ).toBeVisible()
      await expect(
        page.getByText(bought.paymentIntentId, { exact: false }),
        'Stripe internals stay off the success screen',
      ).toHaveCount(0)
    } finally {
      await teardownBoughtOrder(bought)
    }
  })
})
