import type { AdminOrderRow } from '@/app/admin/orders/actions'

// Workflow buckets — each bucket corresponds to one tab on the orders
// page. Order matters (it's the user's mental left-to-right pipeline).
// Shared between the orders list (tab badges) and the admin dashboard
// ("Needs your attention" counters) so both derive a bucket the same way.
export type Bucket =
  | 'new'
  | 'to-place'
  | 'at-tps'
  | 'production'
  | 'shipped'
  | 'delivered'
  | 'done'
  | 'cancelled'
  | 'refunded'
  | 'attention'

export const BUCKET_ORDER: Bucket[] = [
  'new',
  'to-place',
  'at-tps',
  'production',
  'shipped',
  'delivered',
  'done',
  'cancelled',
  'refunded',
  'attention',
]

export function bucketOf(o: AdminOrderRow): Bucket {
  const f = o.fulfillmentStatus
  const p = o.paymentStatus

  if (f === 'Cancelled') return 'cancelled'
  if (p === 'refunded') return 'refunded'
  if (p === 'failed' || p === 'canceled') return 'attention'

  if (f === null && p === 'authorized') return 'new'
  // Captured but not yet placed at TPS: the gallery holds the buyer's money and
  // owes the next action (place + pay at TPS). Derived from succeeded + pending.
  if (f === null && p === 'succeeded') return 'to-place'
  if (f === 'Placed') return 'at-tps'
  if (f === 'Started') return 'production'
  if (f === 'Shipped') return 'shipped'
  // `payoutComplete` is the cart-aware "artist(s) have been paid" signal:
  // every line paid for carts, header paidOutAt for legacy single-print. Using
  // the header field alone would strand a fully-paid CART order in "Delivered".
  if (f === 'Complete' && !o.payoutComplete) return 'delivered'
  if (f === 'Complete' && o.payoutComplete) return 'done'

  return 'attention'
}

// Counts per bucket from a flat list of orders. Buckets with no orders
// are present with a 0, so callers can index any Bucket safely.
export function countByBucket(orders: AdminOrderRow[]): Record<Bucket, number> {
  const counts = Object.fromEntries(BUCKET_ORDER.map((b) => [b, 0])) as Record<Bucket, number>
  for (const o of orders) {
    counts[bucketOf(o)] += 1
  }
  return counts
}

// A captured order that was cancelled but not yet refunded: the buyer's
// money was already taken (`succeeded`) and `cancelOrder` leaves it that
// way with needsRefund=true, so the gallery owes a manual refund. NOT the
// same as a `refunded` order (paymentStatus 'refunded' = already settled).
export function isRefundOwed(o: AdminOrderRow): boolean {
  return o.fulfillmentStatus === 'Cancelled' && o.paymentStatus === 'succeeded'
}

// The metrics the admin dashboard's "Needs your attention" cards surface.
// Most mirror a workflow bucket; refundOwed is a cross-cutting predicate
// (see isRefundOwed) that no single bucket captures.
export type AttentionMetric = 'new' | 'toPlace' | 'refundOwed' | 'deliveredUnpaid' | 'attention'

export function countAttentionMetrics(
  orders: AdminOrderRow[],
): Record<AttentionMetric, number> {
  const buckets = countByBucket(orders)
  return {
    new: buckets.new,
    toPlace: buckets['to-place'],
    deliveredUnpaid: buckets.delivered,
    attention: buckets.attention,
    refundOwed: orders.filter(isRefundOwed).length,
  }
}
