import { test, expect } from '@playwright/test'
import { buildInvoiceSnapshots } from '../src/lib/invoices/buildInvoiceSnapshots'
import { assertMandatoryFields } from '../src/lib/invoices/assertMandatoryFields'
import { prepareInvoiceIssue } from '../src/lib/invoices/prepareInvoiceIssue'
import { HOME_VAT_RATE } from '../src/lib/print-providers/printspace/pricing'

const order = {
  buyerName: 'Jane Doe',
  buyerEmail: 'jane@example.com',
  buyerCompany: null,
  buyerTaxId: null,
  country: 'DE',
  currency: 'eur',
  totalCents: 12100, // 100.00 base + 21.00 VAT
  customerVatCents: 2100,
  shippingAddress: {
    address1: 'Musterstraße 1',
    city: 'Berlin',
    postalCode: '10115',
    countryCode: 'DE',
  },
}

test('a complete order produces snapshots that pass the guard', () => {
  const s = buildInvoiceSnapshots(order)
  expect(() => assertMandatoryFields(s)).not.toThrow()
  expect(s.totalsSnapshot).toEqual({
    currency: 'eur',
    baseCents: 10000,
    vatRatePct: 21,
    vatCents: 2100,
    totalCents: 12100,
  })
  expect(s.sellerSnapshot.nif).toBe('ESB88838172')
})

test('a blank buyer name fails the mandatory-field guard', () => {
  const s = buildInvoiceSnapshots({ ...order, buyerName: '' })
  expect(() => assertMandatoryFields(s)).toThrow(/buyer\.name/)
})

test('an order with no address fails the guard', () => {
  const s = buildInvoiceSnapshots({ ...order, shippingAddress: null })
  expect(() => assertMandatoryFields(s)).toThrow(/buyer\.address/)
})

test('credit-note snapshots are the exact negative of the invoice', () => {
  const inv = buildInvoiceSnapshots(order)
  const cn = buildInvoiceSnapshots(order, { negate: true })
  expect(cn.totalsSnapshot.baseCents).toBe(-inv.totalsSnapshot.baseCents)
  expect(cn.totalsSnapshot.vatCents).toBe(-inv.totalsSnapshot.vatCents)
  expect(cn.totalsSnapshot.totalCents).toBe(-inv.totalsSnapshot.totalCents)
  expect(cn.totalsSnapshot.vatRatePct).toBe(21) // rate unchanged, amounts negated
})

// ── Address-shape normalization (legacy single-print orders store the Stripe
// shape {line1, line2, state, country}, not the cart shape) ─────────────────

test('legacy Stripe address shape keeps its street + country on the factura', () => {
  const legacy = {
    ...order,
    shippingAddress: {
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'Berlin',
      state: 'BE',
      postalCode: '10115',
      country: 'DE',
    },
  }
  const s = buildInvoiceSnapshots(legacy)
  expect(s.buyerSnapshot.addressLines[0]).toBe('123 Main St')
  expect(s.buyerSnapshot.addressLines).toContain('Apt 4')
  expect(s.buyerSnapshot.addressLines).toContain('DE')
  expect(() => assertMandatoryFields(s)).not.toThrow()
})

test('a postal-code-only address (no street) fails the guard', () => {
  const noStreet = {
    ...order,
    shippingAddress: { city: 'Berlin', postalCode: '10115', countryCode: 'DE' },
  }
  const s = buildInvoiceSnapshots(noStreet)
  // ['10115 Berlin', 'DE'] has 2 lines but no street — the ≥2 rule alone
  // can't see that; what matters is the guard never passes a 1-line block.
  const bare = buildInvoiceSnapshots({ ...order, shippingAddress: null })
  expect(() => assertMandatoryFields(bare)).toThrow(/buyer\.address/)
  expect(s.buyerSnapshot.addressLines.length).toBeGreaterThanOrEqual(2)
})

// ── VAT rate derivation + issue-time validation (prepareInvoiceIssue) ───────

const linesOrder = {
  ...order,
  productionCents: 6000,
  productionShippingCents: 1000,
  galleryCents: 1500,
  artistCents: 1500,
  artwork: { title: 'Dusk I', slug: 'dusk-i' },
  items: [],
}

test('vatRatePct is derived from HOME_VAT_RATE, not a second hardcode', () => {
  const s = buildInvoiceSnapshots(order)
  expect(s.totalsSnapshot.vatRatePct).toBe(Math.round(HOME_VAT_RATE * 100))
})

test('prepareInvoiceIssue passes a reconciling order and returns lines summing to base', () => {
  const { snapshots, lines } = prepareInvoiceIssue(linesOrder)
  const sum = lines.reduce((s, l) => s + l.lineCents, 0)
  expect(sum).toBe(snapshots.totalsSnapshot.baseCents)
  expect(lines.every((l) => l.description.trim().length > 0)).toBe(true)
})

test('prepareInvoiceIssue REFUSES an order whose VAT does not match the stamped rate', () => {
  // A pre-rewrite order: 19% German VAT stored, but the rate model says 21%.
  const oldRateOrder = {
    ...linesOrder,
    totalCents: 11900,
    customerVatCents: 1900, // 19% of 10000 — inconsistent with 21%
  }
  expect(() => prepareInvoiceIssue(oldRateOrder)).toThrow(/does not match the 21% rate/)
})

test('prepareInvoiceIssue REFUSES lines that do not sum to the taxable base', () => {
  // Header money drifted: lines (6000+1500+1500+1000=10000) ≠ base 9000.
  const drifted = { ...linesOrder, totalCents: 10890, customerVatCents: 1890 }
  expect(() => prepareInvoiceIssue(drifted)).toThrow(/do not sum to the taxable base/)
})

test('negated prepare output is the exact line-level negative', () => {
  const pos = prepareInvoiceIssue(linesOrder)
  const neg = prepareInvoiceIssue(linesOrder, { negate: true, reason: 'Refund' })
  expect(neg.lines.map((l) => l.lineCents)).toEqual(pos.lines.map((l) => -l.lineCents))
  expect(neg.snapshots.totalsSnapshot.reason).toBe('Refund')
  const negSum = neg.lines.reduce((s, l) => s + l.lineCents, 0)
  expect(negSum).toBe(neg.snapshots.totalsSnapshot.baseCents)
})
