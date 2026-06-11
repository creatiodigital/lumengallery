import { test, expect } from '@playwright/test'

import { deletePrintOrderByPaymentIntent } from './cleanup-helpers'
import { setupOpenFixture, teardownOpenFixture, type OpenFixture } from './edition-helpers'
import {
  TEST_CARDS,
  buildFixturePayment,
  cancelPaymentIntent,
  fillCardAndPay,
  getPaymentIntentStatus,
  gotoPayment,
  seedPaymentSession,
} from './stripe-helpers'

/**
 * Stripe payment surface — tested in isolation.
 *
 * These specs deep-link to /print/payment with a pre-built (fixture)
 * PaymentIntent, skipping the wizard (and its CPU-heavy WebGL preview)
 * and the checkout form entirely. They exercise the real Stripe
 * PaymentElement + the server-authoritative createPaymentIntent action,
 * and assert the resulting PaymentIntent state directly via the Stripe
 * API — so no local `stripe listen` webhook is required.
 *
 * They hit the real (test-mode) Stripe API and need the Stripe test-mode
 * keys in .env.local (present). Run as part of the default suite.
 */

test.describe('Stripe payment', () => {
  // Self-seeded throwaway OPEN artwork — independent of the shared fixture
  // artwork's editionType (which drifts to 'limited' during limited QA).
  let open: OpenFixture
  test.beforeAll(async () => {
    open = await setupOpenFixture()
  })
  test.afterAll(async () => {
    await teardownOpenFixture(open)
  })

  test('valid card authorizes the PaymentIntent (manual capture) and reaches confirmation', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    const { slug, paymentIntentId, stash } = await buildFixturePayment('happy', open.slug)

    try {
      await seedPaymentSession(page, slug, stash)
      await gotoPayment(page, slug)

      await fillCardAndPay(page, TEST_CARDS.success)

      // Stripe redirects to the confirmation page on a successful auth.
      await page.waitForURL(`**/artworks/${slug}/print/confirmation?**`, { timeout: 60_000 })
      const returnedPi = new URL(page.url()).searchParams.get('payment_intent')
      expect(returnedPi, 'confirmation URL should carry the payment_intent').toBe(paymentIntentId)

      // Authoritative check: manual-capture auth leaves the PI held
      // ('requires_capture'), NOT captured — capture only happens when an
      // admin later marks the order placed. No webhook needed to assert this.
      const status = await getPaymentIntentStatus(paymentIntentId)
      expect(status, 'authorized PaymentIntent should be held for capture').toBe('requires_capture')
    } finally {
      // Release the auth and remove any order row the webhook may have
      // created (if a listener happened to be running).
      await cancelPaymentIntent(paymentIntentId)
      await deletePrintOrderByPaymentIntent(paymentIntentId)
    }
  })

  test('declined card surfaces an error and does not authorize', async ({ page }) => {
    test.setTimeout(120_000)

    const { slug, paymentIntentId, stash } = await buildFixturePayment('declined', open.slug)

    try {
      await seedPaymentSession(page, slug, stash)
      await gotoPayment(page, slug)

      await fillCardAndPay(page, TEST_CARDS.declined)

      // A decline must NOT navigate to the confirmation page; the buyer
      // stays on /payment with an error. Give Stripe a moment to respond.
      const errorBanner = page.locator('[class*="paymentError" i], [role="alert"]').first()
      await expect(errorBanner, 'a payment error should be shown').toBeVisible({ timeout: 30_000 })
      expect(page.url(), 'should stay on the payment page after a decline').toContain(
        `/print/payment`,
      )

      // Authoritative check: the PI was never authorized — still awaiting
      // a usable payment method.
      const status = await getPaymentIntentStatus(paymentIntentId)
      expect(status, 'declined PaymentIntent should not be held for capture').not.toBe(
        'requires_capture',
      )
    } finally {
      await cancelPaymentIntent(paymentIntentId)
      await deletePrintOrderByPaymentIntent(paymentIntentId)
    }
  })
})
