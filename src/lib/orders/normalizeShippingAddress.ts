/**
 * Normalize the two shippingAddress JSON shapes stored on PrintOrder.
 *
 * Cart orders store the checkout shape:
 *   { address1, address2, city, stateOrRegion, postalCode, countryCode, phone }
 * Legacy single-print orders store the Stripe shape:
 *   { line1, line2, city, state, postalCode | postal_code, country, phone }
 *
 * Every consumer that renders or freezes a buyer address (order detail,
 * invoices) must read through this helper so the street and country never go
 * blank on one of the two shapes.
 */

export type NormalizedShippingAddress = {
  street1: string
  street2: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function normalizeShippingAddress(raw: unknown): NormalizedShippingAddress {
  const a = (raw ?? {}) as Record<string, unknown>
  return {
    street1: str(a.address1) || str(a.line1),
    street2: str(a.address2) || str(a.line2),
    city: str(a.city),
    state: str(a.stateOrRegion) || str(a.state),
    postalCode: str(a.postalCode) || str(a.postal_code),
    country: str(a.countryCode) || str(a.country),
    phone: str(a.phone),
  }
}
