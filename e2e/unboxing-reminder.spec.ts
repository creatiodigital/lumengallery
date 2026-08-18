import { test, expect } from '@playwright/test'

import { seedCookieConsent } from './consent-helpers'
import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * The unboxing request shown once on the cart confirmation step.
 *
 * Why it lives here rather than before the pay button: a gate at payment adds
 * friction at the worst moment and lands weeks before the parcel does. This
 * asks while the buyer is still on the page, and the shipped/delivered emails
 * (covered in email-templates.spec.ts) repeat it when the box is at the door.
 *
 * Reached the same way a 3DS return reaches it: /checkout?payment_intent=…,
 * which verifies the PI server-side and lands on the confirmation step — no
 * card iframe, no wizard, no WebGL.
 */
test.describe('Unboxing reminder (cart confirmation)', () => {
  test('appears once after a confirmed order, dismisses, and does not nag again', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited(1)

      await seedCookieConsent(page)
      await page.goto(`/checkout?payment_intent=${bought.paymentIntentId}`)

      // The order must be confirmed first — the reminder never shows on the
      // "we couldn't finalize" path, where the buyer has a real problem.
      await expect(page.getByText(/your order is confirmed/i)).toBeVisible({ timeout: 30_000 })

      const dialog = page.getByRole('dialog')
      await expect(dialog, 'the unboxing request is shown').toBeVisible()
      await expect(dialog.getByText(/kindly suggest taking a few photos/i)).toBeVisible()
      await expect(
        dialog.getByText(/reprint or a refund right away/i),
        'the reason is stated, not just the ask',
      ).toBeVisible()

      await dialog.getByRole('button', { name: 'Got it' }).click()
      await expect(dialog, 'dismissing closes it').toBeHidden()

      // The confirmation itself survives the dismissal.
      await expect(page.getByText(/your order is confirmed/i)).toBeVisible()

      // Dismissal is remembered per order, so a re-render can't re-nag.
      const remembered = await page.evaluate(
        (pi) => sessionStorage.getItem(`the-art-room:unboxing-reminder:${pi}`),
        bought.paymentIntentId,
      )
      expect(remembered, 'the dismissal is recorded for this order').toBe('1')
    } finally {
      await teardownBoughtOrder(bought)
    }
  })
})
