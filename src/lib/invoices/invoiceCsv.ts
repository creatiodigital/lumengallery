/**
 * Pure CSV builder for the invoice register. Kept separate from server
 * actions so it can be unit-tested without Next.js infra.
 *
 * Follows RFC 4180: fields containing commas, double-quotes, or newlines
 * are wrapped in double-quotes, and any embedded double-quotes are escaped
 * by doubling them ("").
 *
 * Buyer-controlled text additionally gets spreadsheet-formula neutralization:
 * a cell starting with = + - @ (or tab/CR) executes as a formula when the
 * accountant opens the register in Excel/Sheets — a checkout "name" like
 * =WEBSERVICE(...) must land as inert text. Plain negative numbers (credit
 * notes) are exempt: "-84.70" is a number, not a formula.
 */

import type { InvoiceRow } from '@/lib/invoices/queryInvoices'

/** Escape a single CSV field value per RFC 4180. */
function csvField(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** RFC 4180 escaping + formula neutralization for buyer-controlled text. */
function csvTextField(value: string | null | undefined): string {
  const s = value == null ? '' : String(value)
  const looksLikeFormula = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)
  return csvField(looksLikeFormula ? `'${s}` : s)
}

/** Cents → decimal euros string, e.g. 10050 → "100.50". */
function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2)
}

const HEADERS = [
  'Number',
  'Type',
  'Rectifies', // credit notes: the invoice number this document corrects
  'Voided by', // invoices: the credit-note number that rectified this invoice
  'Issue date',
  'Client',
  'Email',
  'Tax ID',
  'Base (EUR)',
  'VAT %',
  'VAT (EUR)',
  'Total (EUR)',
  'Currency',
  'Order',
]

export function invoiceRegisterToCsv(rows: InvoiceRow[]): string {
  const lines: string[] = [HEADERS.map(csvField).join(',')]

  for (const row of rows) {
    const vatPct = row.vatRatePct != null ? row.vatRatePct : ''

    lines.push(
      [
        csvField(row.number),
        csvField(row.type === 'invoice' ? 'Invoice' : 'Credit note'),
        csvField(row.correctsNumber ?? ''),
        csvField(row.rectifiedByNumber ?? ''),
        csvField(row.issuedAt.slice(0, 10)), // YYYY-MM-DD
        csvTextField(row.buyerName),
        csvTextField(row.buyerEmail),
        csvTextField(row.buyerTaxId),
        csvField(centsToEur(row.baseCents)),
        csvField(vatPct),
        csvField(centsToEur(row.vatCents)),
        csvField(centsToEur(row.totalCents)),
        csvField(row.currency.toUpperCase()),
        csvField(row.orderId),
      ].join(','),
    )
  }

  return lines.join('\r\n')
}
