import { test, expect } from '@playwright/test'

import { isDeadPaymentIntentStatus } from '../src/lib/orders/settleDeadPaymentIntent'

/**
 * An uncaptured authorization dies by itself after ~7 days and Stripe cancels
 * the PaymentIntent. Until 2026-08-22 the ONLY thing that noticed was the
 * `payment_intent.canceled` webhook — and the sandbox had no webhook endpoint
 * registered for two months, which left four orders stuck at "authorized" with
 * four edition numbers permanently out of stock.
 *
 * The reconcile cron now settles those too. What it must never do is free a
 * number whose payment is still alive, so the definition of "dead" is pinned
 * here: only Stripe's own terminal cancellation counts.
 */

test('a canceled PaymentIntent is dead', () => {
  expect(isDeadPaymentIntentStatus('canceled')).toBe(true)
})

// These read like failures but are still confirmable — a buyer can be mid
// checkout, typing card details. Releasing a number under one of them is how
// the same numbered copy gets sold twice.
for (const status of ['requires_payment_method', 'requires_confirmation', 'requires_action']) {
  test(`"${status}" is NOT dead — the buyer may still be paying`, () => {
    expect(isDeadPaymentIntentStatus(status)).toBe(false)
  })
}

// The money is live or already taken; nothing to settle.
for (const status of ['requires_capture', 'processing', 'succeeded']) {
  test(`"${status}" is NOT dead — the payment is live or captured`, () => {
    expect(isDeadPaymentIntentStatus(status)).toBe(false)
  })
}
