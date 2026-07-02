import type { InvoiceSnapshots } from './buildInvoiceSnapshots'
import type { InvoiceLine } from './buildInvoiceLines'

// Legally-required factura fields (Reglamento de facturación, RD 1619/2012).
// A document missing any mandatory field must FAIL to issue (loud error) —
// never silently produce an invalid factura.
//
// Pass the built lines too: RD 1619/2012 also requires a description of every
// operation, and lines must exist BEFORE the number is minted so a defective
// line set can never burn a number.
export function assertMandatoryFields(s: InvoiceSnapshots, lines?: InvoiceLine[]): void {
  const req = (cond: boolean, field: string) => {
    if (!cond) throw new Error(`Invoice missing mandatory field: ${field}`)
  }
  req(!!s.sellerSnapshot?.legalName, 'seller.legalName')
  req(!!s.sellerSnapshot?.nif, 'seller.nif')
  req((s.sellerSnapshot?.addressLines?.length ?? 0) > 0, 'seller.address')
  req(!!s.buyerSnapshot?.name, 'buyer.name')
  // A postal code + city alone is not a valid address block — require at
  // least a street line plus a locality line (both order shapes produce
  // street first when present).
  req((s.buyerSnapshot?.addressLines?.length ?? 0) >= 2, 'buyer.address (street + locality)')
  req(!!s.buyerSnapshot?.countryCode, 'buyer.country')
  req(typeof s.totalsSnapshot?.baseCents === 'number', 'totals.baseCents')
  req(typeof s.totalsSnapshot?.vatRatePct === 'number', 'totals.vatRatePct')
  req(typeof s.totalsSnapshot?.vatCents === 'number', 'totals.vatCents')
  req(typeof s.totalsSnapshot?.totalCents === 'number', 'totals.totalCents')
  if (lines) {
    req(lines.length > 0, 'lines (at least one line item)')
    for (const line of lines) {
      req(!!line.description?.trim(), 'line.description')
      req(typeof line.lineCents === 'number', 'line.lineCents')
    }
  }
}
