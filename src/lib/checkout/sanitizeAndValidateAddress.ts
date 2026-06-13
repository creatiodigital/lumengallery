/**
 * Shared shipping-address tamper defense for the checkout boundary.
 *
 * BOTH server entry points that accept a buyer address must run this:
 *   - single-print: createPaymentIntent.ts (inlined equivalent, kept in
 *     lockstep), and
 *   - cart: validateCart.ts (so validateCartAction AND createCartPaymentIntent
 *     are both covered — validateCart is the first thing each calls).
 *
 * A server action is a directly POST-able endpoint, so a malformed payload is
 * a tamper signal, not user error. We type-check every field, sanitizeLine it
 * (strip control chars / zero-width Unicode / collapse whitespace), cap length
 * AFTER sanitize (so control-char padding can't sneak past raw byte count),
 * require the structurally-mandatory fields, and do a cheap email shape check.
 *
 * MUTATES the address in place with the sanitized values so a single call at
 * the boundary cleans everything downstream (Stripe PI shipping, PendingCart
 * columns, the webhook's PrintOrder copy). Mirrors exactly the inline checks in
 * createPaymentIntent.ts:149-213 — any change here must be mirrored there.
 */
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'
import { sanitizeLine } from '@/utils/sanitizeLine'

const MAX_ADDRESS_FIELD_LEN = 200

export function sanitizeAndValidateAddress(
  address: ShippingAddress,
): { ok: true } | { ok: false } {
  if (!address || typeof address !== 'object') return { ok: false }
  if (!address.countryCode || address.countryCode.length !== 2) {
    return { ok: false }
  }

  // Type-check first, then sanitize, then length-check.
  const rawFields = [
    address.fullName,
    address.email,
    address.phone,
    address.address1,
    address.address2,
    address.city,
    address.stateOrRegion,
    address.postalCode,
  ]
  if (rawFields.some((s) => typeof s !== 'string')) {
    return { ok: false }
  }

  // Mutate in place — downstream Stripe metadata, PI shipping and the
  // PendingCart write all read from this same object.
  address.fullName = sanitizeLine(address.fullName)
  address.email = sanitizeLine(address.email)
  address.phone = sanitizeLine(address.phone)
  address.address1 = sanitizeLine(address.address1)
  address.address2 = sanitizeLine(address.address2)
  address.city = sanitizeLine(address.city)
  address.stateOrRegion = sanitizeLine(address.stateOrRegion)
  address.postalCode = sanitizeLine(address.postalCode)

  const sanitizedFields = [
    address.fullName,
    address.email,
    address.phone,
    address.address1,
    address.address2,
    address.city,
    address.stateOrRegion,
    address.postalCode,
  ]
  if (sanitizedFields.some((s) => s.length > MAX_ADDRESS_FIELD_LEN)) {
    return { ok: false }
  }

  // Required-field presence (post-sanitize, so pure-whitespace input that
  // slipped past the client's `required` is rejected here).
  if (
    !address.fullName ||
    !address.email ||
    !address.phone ||
    !address.address1 ||
    !address.city ||
    !address.postalCode
  ) {
    return { ok: false }
  }

  // Email must contain a '@' (not first char) and a '.' after it. Cheap
  // structural check; Stripe + Resend re-validate format downstream.
  const atIndex = address.email.indexOf('@')
  if (atIndex < 1 || address.email.indexOf('.', atIndex) < 0) {
    return { ok: false }
  }

  return { ok: true }
}
