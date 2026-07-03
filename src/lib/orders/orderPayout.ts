/**
 * Whether an order's artist payout is complete, and when.
 *
 * Cart orders pay each artist PER ITEM (PrintOrderItem.paidOutAt); the order
 * header's paidOutAt is never stamped for them. Legacy single-print orders use
 * the header. The orders list (bucketing + payout column) and the detail page
 * must read the SAME rule, or a fully-paid cart order gets stranded in
 * "Delivered" instead of moving to "Artist paid".
 *
 * A reversed (clawed-back) line keeps its stale paidOutAt, so it does NOT count
 * as paid — otherwise a refunded order could still read "Artists paid".
 */
type PayoutItem = { paidOutAt: Date | null; transferStatus: string | null }

export type OrderPayout = {
  /** True once every artist on the order has been paid. */
  complete: boolean
  /** Effective payout date for display (latest line for carts; header for legacy). */
  at: Date | null
  /** True when the (complete) payout was settled off-Stripe by hand. */
  manual: boolean
}

export function computeOrderPayout(
  items: PayoutItem[],
  headerPaidOutAt: Date | null,
  headerTransferStatus: string | null,
): OrderPayout {
  if (items.length > 0) {
    const complete = items.every((it) => !!it.paidOutAt && it.transferStatus !== 'reversed')
    const dates = items.map((it) => it.paidOutAt).filter((d): d is Date => !!d)
    const at =
      complete && dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null
    const manual = complete && items.every((it) => it.transferStatus === 'paid_manual')
    return { complete, at, manual }
  }
  return {
    complete: !!headerPaidOutAt,
    at: headerPaidOutAt,
    manual: headerTransferStatus === 'paid_manual',
  }
}
