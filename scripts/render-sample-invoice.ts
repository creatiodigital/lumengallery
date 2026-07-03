/**
 * Render SAMPLE invoice + credit-note PDFs for visual review — kept in the
 * repo (scripts/sample-invoice.pdf, scripts/sample-credit-note.pdf) so the
 * document design can always be checked without minting real numbers or
 * touching the DB. All data below is fictional ("John Doe" convention).
 *
 * Regenerate after any InvoiceDocument change:
 *   npx dotenv -e .env.local -- npx tsx scripts/render-sample-invoice.ts
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { renderInvoicePdf } from '@/lib/invoices/renderInvoicePdf'
import { SELLER_IDENTITY } from '@/lib/invoices/sellerIdentity'

const issuedAt = new Date(2026, 6, 3) // fixed date → stable, diffable output

const buyerSnapshot = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  company: null,
  taxId: null,
  addressLines: ['123 Sample Street, Apt 4', '1000 Brussels', 'Belgium'],
  countryCode: 'BE',
}

// One framed limited print + shipping. Lines must sum to the taxable base;
// VAT 21% (EU B2C) on top — mirrors prepareInvoiceIssue's reconciliation.
const lines = [
  {
    description:
      'Limited edition print 3/30 — "Landscapes and Long Name Photography" · Giclée · Hahnemühle German Etching · 40 × 27.9 cm · framed',
    qty: 1,
    unitCents: 25000,
    lineCents: 25000,
  },
  { description: 'Shipping & handling (tracked, EU)', qty: 1, unitCents: 2635, lineCents: 2635 },
]
const baseCents = lines.reduce((s, l) => s + l.lineCents, 0)
const vatRatePct = 21
const vatCents = Math.round((baseCents * vatRatePct) / 100)

const totalsSnapshot = {
  currency: 'eur',
  baseCents,
  vatRatePct,
  vatCents,
  totalCents: baseCents + vatCents,
}

async function main() {
  const outDir = path.resolve(__dirname)

  const invoice = await renderInvoicePdf({
    number: 'AR-07-2026-001',
    issuedAt,
    type: 'invoice',
    sellerSnapshot: { ...SELLER_IDENTITY, addressLines: [...SELLER_IDENTITY.addressLines] },
    buyerSnapshot,
    totalsSnapshot,
    lines,
  })
  const invoicePath = path.join(outDir, 'sample-invoice.pdf')
  writeFileSync(invoicePath, invoice)
  console.log(`wrote ${invoicePath} (${invoice.length} bytes)`)

  const creditNote = await renderInvoicePdf({
    number: 'AR-R-07-2026-001',
    issuedAt,
    type: 'credit_note',
    correctsNumber: 'AR-07-2026-001',
    reason: 'Order cancelled by buyer — full refund',
    sellerSnapshot: { ...SELLER_IDENTITY, addressLines: [...SELLER_IDENTITY.addressLines] },
    buyerSnapshot,
    totalsSnapshot: {
      ...totalsSnapshot,
      baseCents: -totalsSnapshot.baseCents,
      vatCents: -totalsSnapshot.vatCents,
      totalCents: -totalsSnapshot.totalCents,
    },
    lines: lines.map((l) => ({ ...l, unitCents: -l.unitCents, lineCents: -l.lineCents })),
  })
  const cnPath = path.join(outDir, 'sample-credit-note.pdf')
  writeFileSync(cnPath, creditNote)
  console.log(`wrote ${cnPath} (${creditNote.length} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
