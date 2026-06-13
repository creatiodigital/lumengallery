/**
 * Server-authoritative cart validation + order totals.
 *
 * Re-validates and re-prices EVERY line against the live catalog/pricing
 * (the cart's stored unit cents are a display snapshot only), then folds
 * the lines into a single order total. This is the cart analogue of the
 * per-order math in createPaymentIntent.ts and will be reused by Task 8's
 * PaymentIntent creation.
 *
 * Shipping model (user-confirmed): TPS charges flat per SHIPMENT, so a
 * multi-line order has ONE consolidated shipping line = the MAX over
 * items of each item's shipping line (a framed item sets the parcel fee;
 * extra prints add no shipping). It is NOT a sum. VAT is computed ONCE on
 * the whole-order taxable base (sum of item pre-tax subtotals + the
 * single shipping line).
 */
import type { ProviderId, WizardConfig } from '@/lib/print-providers'
import { getVatRate } from '@/lib/print-providers/printspace/pricing'
import { validateAndPriceItem } from '@/lib/checkout/validateAndPriceItem'
import type { ItemPricing } from '@/lib/checkout/validateAndPriceItem'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

/**
 * Hard ceiling on the buyer-facing total. Mirrors MAX_TOTAL_CENTS in
 * createPaymentIntent.ts — any total above this is treated as a
 * config/pricing-tamper signal and refused rather than charged. €10,000.
 * Kept in sync with the single-print ceiling.
 */
const MAX_TOTAL_CENTS = 1_000_000

/** Minimal shape validateCart needs from a cart line. The full CartItem
 *  already satisfies this. */
export type CartLikeItem = {
  lineId: string
  artworkSlug: string
  providerId: ProviderId
  config: WizardConfig
  variantId?: string
  editionType: 'open' | 'limited'
  quantity: number
}

export type CartTotals = {
  perItem: Array<{
    lineId: string
    lineProductionCents: number
    lineArtistCents: number
    lineGalleryCents: number
    linePreTaxCents: number
    quantity: number
  }>
  itemsPreTaxCents: number
  shippingCents: number
  customerVatCents: number
  totalCents: number
  currency: string
}

export type CartValidationFailure = { lineId: string; error: string }

export async function validateCart(
  items: CartLikeItem[],
  address: ShippingAddress,
): Promise<{ ok: true; totals: CartTotals } | { ok: false; failures: CartValidationFailure[] }> {
  if (items.length === 0) {
    return { ok: false, failures: [{ lineId: '', error: 'Your cart is empty.' }] }
  }

  // Validate + price every line. Run sequentially: validateAndPriceItem
  // hits the DB + catalog, and carts are small; keeping it ordered also
  // makes the failure list deterministic.
  const failures: CartValidationFailure[] = []
  const priced: Array<{ item: CartLikeItem; pricing: ItemPricing }> = []

  for (const item of items) {
    // Quantity is client-supplied (the cart lives in localStorage) and is
    // multiplied into the per-line money below, so it must be a positive
    // integer. A tampered fractional quantity would otherwise produce
    // fractional line cents (line cents are NOT rounded; only VAT is) and a
    // non-integer Stripe amount when Task 8 consumes these totals. Open
    // editions are uncapped by design, so a large HONEST quantity is
    // legitimate; the per-variant limited stock cap is re-checked in Task 8.
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      failures.push({ lineId: item.lineId, error: 'Invalid quantity for this item.' })
      continue
    }

    const result = await validateAndPriceItem({
      artworkSlug: item.artworkSlug,
      providerId: item.providerId,
      config: item.config,
      variantId: item.variantId,
      countryCode: address.countryCode,
    })
    if (!result.ok) {
      failures.push({ lineId: item.lineId, error: result.error })
      continue
    }
    priced.push({ item, pricing: result.pricing })
  }

  if (failures.length > 0) {
    return { ok: false, failures }
  }

  // Per-line money = unit pricing × quantity. pricing.preTaxCents is the
  // artwork line ONLY (shipping-free by contract — see validateAndPriceItem),
  // so itemsPreTaxCents below holds artwork-only subtotals and the single
  // consolidated shipping line is added exactly once into the taxable base.
  const perItem = priced.map(({ item, pricing }) => ({
    lineId: item.lineId,
    lineProductionCents: pricing.productionCents * item.quantity,
    lineArtistCents: pricing.artistCents * item.quantity,
    lineGalleryCents: pricing.galleryCents * item.quantity,
    linePreTaxCents: pricing.preTaxCents * item.quantity,
    quantity: item.quantity,
  }))

  const itemsPreTaxCents = perItem.reduce((sum, l) => sum + l.linePreTaxCents, 0)

  // Flat-per-shipment: one consolidated parcel fee = the MAX over items
  // of each item's shipping line (a framed item sets the parcel fee;
  // extra prints add no shipping). NOT a sum.
  // TODO: calibrate the exact multi-item parcel fee against real TPS
  // quotes — the true cost of, e.g., two framed prints in one shipment is
  // not yet known; MAX is the safe conservative placeholder for now.
  const shippingCents = priced.reduce((max, { pricing }) => Math.max(max, pricing.shippingCents), 0)

  // currency from the items' quotes — all the same provider, so identical
  // across lines; take the first.
  const currency = priced[0].pricing.currency

  // VAT computed ONCE on the whole-order taxable base (all pre-tax line
  // subtotals + the single shipping line). Same per-country rate table as
  // the single-print path and the checkout preview.
  const taxableBase = itemsPreTaxCents + shippingCents
  const customerVatCents = Math.round(taxableBase * getVatRate(address.countryCode))
  const totalCents = taxableBase + customerVatCents

  // Final sanity check — same ceiling as the single-print path. Anything
  // out of range is a pricing-tamper signal; refuse rather than charge.
  if (totalCents <= 0 || totalCents > MAX_TOTAL_CENTS) {
    return {
      ok: false,
      failures: [
        { lineId: '', error: 'Could not finalize this order. Please try again or contact us.' },
      ],
    }
  }

  return {
    ok: true,
    totals: {
      perItem,
      itemsPreTaxCents,
      shippingCents,
      customerVatCents,
      totalCents,
      currency,
    },
  }
}
