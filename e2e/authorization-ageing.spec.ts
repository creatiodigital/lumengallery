import { test, expect } from '@playwright/test'

import {
  AUTHORIZATION_WARNING_DAYS,
  authorizationHold,
} from '../src/lib/orders/authorizationPolicy'

/**
 * The preventive half of the expired-authorization leak.
 *
 * Stripe voids an uncaptured hold on its own. When it does, the buyer is never
 * charged, the order dies, and its numbered copy goes back in the pool — a sale
 * lost silently, days after anyone last looked. Four of these were found in
 * June and July, each holding a copy that could never be sold.
 *
 * `settleDeadPaymentIntent` cleans up after that has already happened. This is
 * the part that stops it happening: a countdown an admin can see while the hold
 * is still alive and the sale still savable.
 *
 * Pure date arithmetic — no browser, no DB.
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

const authorized = (createdAt: Date) => ({ paymentStatus: 'authorized', createdAt })

test('an order with no live hold has no countdown', () => {
  // Captured, refunded, cancelled, still processing — none of them is holding a
  // buyer's card, so none of them is running out of time.
  for (const paymentStatus of ['succeeded', 'refunded', 'canceled', 'failed', 'processing']) {
    expect(authorizationHold({ paymentStatus, createdAt: daysAgo(30) })).toBeNull()
  }
})

test('a hold taken today is fresh', () => {
  const hold = authorizationHold(authorized(daysAgo(0)))
  expect(hold?.days).toBe(0)
  expect(hold?.status).toBe('fresh')
})

test('a hold counts whole days, and the days left with them', () => {
  const hold = authorizationHold(authorized(daysAgo(3)))
  expect(hold?.days).toBe(3)
  expect(hold?.daysLeft).toBe(4)
  expect(hold?.status).toBe('fresh')
})

test('the warning starts on day 5, not day 6', () => {
  // Day 5 leaves two working days to act, so a Friday warning survives the
  // weekend. Day 6 can leave a Sunday and nothing else.
  expect(AUTHORIZATION_WARNING_DAYS).toBe(5)
  expect(authorizationHold(authorized(daysAgo(4)))?.status).toBe('fresh')
  expect(authorizationHold(authorized(daysAgo(5)))?.status).toBe('expiring')
  expect(authorizationHold(authorized(daysAgo(6)))?.status).toBe('expiring')
})

test('a hold past its lifetime reads as expired, not as almost-due', () => {
  // Stripe has very likely already voided it. Saying "0 days left" would invite
  // an admin to try a capture that can only fail.
  const hold = authorizationHold(authorized(daysAgo(9)))
  expect(hold?.status).toBe('expired')
  expect(hold?.daysLeft).toBeLessThanOrEqual(0)
})

test('days left never counts below zero', () => {
  expect(authorizationHold(authorized(daysAgo(40)))?.daysLeft).toBe(0)
})

test('an ISO string is read the same as a Date', () => {
  // The admin list receives createdAt serialized; the cron holds a real Date.
  const iso = authorizationHold(authorized(daysAgo(5)))
  const str = authorizationHold({ paymentStatus: 'authorized', createdAt: daysAgo(5).toISOString() })
  expect(str?.days).toBe(iso?.days)
  expect(str?.status).toBe(iso?.status)
})
