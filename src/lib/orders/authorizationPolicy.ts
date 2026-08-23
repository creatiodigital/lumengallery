/**
 * How long a buyer's authorization has left, and when to start worrying.
 *
 * We authorize at checkout and capture when the order is placed at TPS, so
 * between those two moments the sale depends on a hold that Stripe will void on
 * its own schedule. If it lapses the buyer is never charged, the order dies,
 * and its numbered copy returns to the pool — a lost sale that announces itself
 * to nobody. Four of those were found in June and July 2026, each sitting on a
 * copy that could never be sold (see settleDeadPaymentIntent, which cleans up
 * AFTER the fact; this is the part that stops it happening).
 *
 * WHICH TIMESTAMP. There is no `authorizedAt` column, and none is needed: an
 * order row is CREATED at paymentStatus 'authorized' — both
 * createPrintOrderFromCart and createPrintOrderFromPaymentIntent write it that
 * way — so `createdAt` is the moment the hold was taken, to within the webhook's
 * delivery lag. Deriving it beats adding a column, and a column here would mean
 * a production schema migration for a display concern.
 *
 * SEVEN DAYS is the conservative floor, not a universal truth. Stripe holds a
 * card authorization about 7 days and a PayPal one up to 20. We do not record
 * which method paid, so we assume the shorter, and a PayPal order is warned
 * about earlier than it strictly needs to be. That is the right direction to be
 * wrong in: a warning an admin glances at and dismisses costs seconds, and a
 * warning that never came costs the sale and strands the copy.
 */
export const AUTHORIZATION_LIFETIME_DAYS = 7

/**
 * Warn from day 5. That leaves two working days to act, so a Friday warning
 * survives the weekend; day 6 can leave a Sunday and nothing else.
 */
export const AUTHORIZATION_WARNING_DAYS = 5

export type AuthorizationHold = {
  /** Whole days since the hold was taken. */
  days: number
  /** Whole days before Stripe voids it. Floored at 0 — never negative. */
  daysLeft: number
  /**
   * `fresh` — nothing to do yet.
   * `expiring` — act now: capture it, or cancel and tell the buyer.
   * `expired` — past its lifetime; Stripe has very likely voided it already,
   *   so a capture can only fail. Distinct from `expiring` on purpose, because
   *   "0 days left" would invite exactly that doomed attempt.
   */
  status: 'fresh' | 'expiring' | 'expired'
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The countdown on an order's authorization, or null if it isn't holding one.
 *
 * Only `authorized` has a live hold. A captured, refunded, cancelled or failed
 * order is settled, and one still `processing` has not authorized yet.
 */
export function authorizationHold(order: {
  paymentStatus: string
  createdAt: Date | string
}): AuthorizationHold | null {
  if (order.paymentStatus !== 'authorized') return null

  const takenAt =
    typeof order.createdAt === 'string' ? Date.parse(order.createdAt) : order.createdAt.getTime()
  if (!Number.isFinite(takenAt)) return null

  const days = Math.floor((Date.now() - takenAt) / DAY_MS)
  const daysLeft = Math.max(0, AUTHORIZATION_LIFETIME_DAYS - days)
  const status =
    days >= AUTHORIZATION_LIFETIME_DAYS
      ? 'expired'
      : days >= AUTHORIZATION_WARNING_DAYS
        ? 'expiring'
        : 'fresh'

  return { days, daysLeft, status }
}

/** Whether this hold is worth an admin's attention today. */
export function needsAttention(hold: AuthorizationHold | null): boolean {
  return hold !== null && hold.status !== 'fresh'
}
