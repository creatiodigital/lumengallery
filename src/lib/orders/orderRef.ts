/**
 * The buyer-facing reference for an order — the ONLY identifier a customer
 * should ever be shown or asked to quote.
 *
 * Orders are keyed internally by UUID and by Stripe PaymentIntent id. Neither
 * belongs in front of a buyer: a UUID is unreadable and a `pi_…` is Stripe's
 * plumbing. This takes the first 8 characters of the order id, uppercased —
 * short enough to read down a phone line, long enough that a collision needs
 * ~50k orders before it's even worth thinking about (and the admin search
 * shows every match rather than guessing).
 *
 * Use this EVERYWHERE the reference is displayed — every email, the
 * confirmation screen, the admin list and detail. It previously lived inline
 * in 19 places with three different results (`AD81E642`, `ad81e642` and
 * `#ad81e642`), which meant one order answered to several names depending on
 * which message the buyer was reading.
 */
export const ORDER_REF_LENGTH = 8

export function formatOrderRef(orderId: string): string {
  return orderId.slice(0, ORDER_REF_LENGTH).toUpperCase()
}

/**
 * Does this order match what someone typed into the admin search? Accepts the
 * buyer-facing reference, a full order id, a Stripe PaymentIntent id, or any
 * fragment of the buyer's name, email or the artwork title — because a buyer
 * quoting "pi_3U5pTs…" from their confirmation screen must be findable by the
 * same box as one quoting "AD81E642" from their email.
 *
 * Case- and whitespace-insensitive; a leading "#" is tolerated since the admin
 * used to print references that way.
 */
export function orderMatchesQuery(
  order: {
    id: string
    paymentIntentId: string
    buyerName?: string | null
    buyerEmail?: string | null
    artwork?: { title?: string | null } | null
  },
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase().replace(/^#/, '')
  if (!q) return true

  const haystack = [
    order.id,
    formatOrderRef(order.id),
    order.paymentIntentId,
    order.buyerName ?? '',
    order.buyerEmail ?? '',
    order.artwork?.title ?? '',
  ]

  return haystack.some((field) => field.toLowerCase().includes(q))
}
