import { HOME_VAT_RATE } from '@/lib/print-providers/printspace/pricing'
import { normalizeShippingAddress } from '@/lib/orders/normalizeShippingAddress'

import { SELLER_IDENTITY } from './sellerIdentity'

// Freeze the seller / buyer / totals into immutable JSON snapshots at issue
// time (AR-131). A later order/config/seller edit never alters an issued
// document. For a credit note pass { negate: true } so every amount is the
// exact negative of the original invoice.
//
// The shippingAddress is read through normalizeShippingAddress so BOTH stored
// shapes (cart checkout vs legacy Stripe) produce a full street + country
// address block — an invoice without a street address is invalid (RD 1619/2012).

export type SnapshotOrderLike = {
  buyerName: string
  buyerEmail: string
  buyerCompany?: string | null
  buyerTaxId?: string | null
  country: string
  currency: string
  totalCents: number
  customerVatCents: number
  /** Either the cart shape {address1,…,countryCode} or the legacy Stripe
   *  shape {line1,…,country} — normalized internally. */
  shippingAddress?: unknown
}

/**
 * THE canonical snapshot shapes. Every writer (buildInvoiceSnapshots →
 * issueInvoiceRecord) and every reader (IssuedInvoice, queryInvoices, the
 * PDF's InvoiceDocumentProps, the admin issue/re-send pipeline) must
 * reference these — never re-declare a structural copy, or a shape change
 * ships silently and the stored JSON drifts from what readers expect.
 */
export type SellerSnapshot = {
  legalName: string
  nif: string
  addressLines: string[]
  email: string
  phone: string
  website: string
}

export type BuyerSnapshot = {
  name: string
  email: string
  company: string | null
  taxId: string | null
  addressLines: string[]
  countryCode: string
}

export type TotalsSnapshot = {
  currency: string
  baseCents: number
  vatRatePct: number
  vatCents: number
  totalCents: number
  /** Optional correction reason stored inside the snapshot JSON for credit
   *  notes (no separate schema column). Set after buildInvoiceSnapshots()
   *  returns, before passing to issueInvoiceRecord(). */
  reason?: string
}

export type InvoiceSnapshots = {
  sellerSnapshot: SellerSnapshot
  buyerSnapshot: BuyerSnapshot
  totalsSnapshot: TotalsSnapshot
}

export function buildInvoiceSnapshots(
  order: SnapshotOrderLike,
  opts: { negate?: boolean } = {},
): InvoiceSnapshots {
  const sign = opts.negate ? -1 : 1
  const addr = normalizeShippingAddress(order.shippingAddress)
  const baseCents = order.totalCents - order.customerVatCents

  return {
    sellerSnapshot: { ...SELLER_IDENTITY },
    buyerSnapshot: {
      name: order.buyerName,
      email: order.buyerEmail,
      company: order.buyerCompany ?? null,
      taxId: order.buyerTaxId ?? null,
      addressLines: [
        addr.street1,
        addr.street2,
        [addr.postalCode, addr.city].filter(Boolean).join(' '),
        addr.state,
        addr.country || order.country,
      ].filter((l): l is string => Boolean(l && l.trim())),
      countryCode: order.country,
    },
    totalsSnapshot: {
      currency: order.currency,
      baseCents: baseCents * sign,
      // Derived from the single VAT source (pricing.ts), never a second
      // hardcode — if Spain's rate changes, the invoice follows checkout.
      vatRatePct: order.customerVatCents > 0 ? Math.round(HOME_VAT_RATE * 100) : 0,
      vatCents: order.customerVatCents * sign,
      totalCents: order.totalCents * sign,
    },
  }
}
