/** Result of ensuring an order exists for a PaymentIntent. `created` is true
 *  when this call built the row, false when it found one already there (e.g.
 *  the webhook won the race). */
export type EnsureOrderResult =
  | { ok: true; orderId: string; created: boolean }
  | { ok: false; error: string }
