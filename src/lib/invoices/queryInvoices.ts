/**
 * AR-131 — THE single register query. The register page, the CSV export and
 * the ZIP export must always agree on filtering + ordering, so all three call
 * this helper (a divergence here means "the ZIP contains different documents
 * than the register showed" — an accountant-handoff hazard).
 *
 * Rectification linkage is resolved through the DB relation (not an in-period
 * map) so a credit note issued in a LATER month than the invoice it corrects
 * still links up when the register is filtered to a single period.
 */

import prisma from '@/lib/prisma'

// The canonical snapshot shapes — imported, never re-declared.
import type { BuyerSnapshot, TotalsSnapshot } from './buildInvoiceSnapshots'

export type InvoiceRow = {
  id: string
  number: string
  type: 'invoice' | 'credit_note'
  issuedAt: string
  buyerName: string
  buyerEmail: string
  buyerTaxId: string | null
  vatRatePct: number
  baseCents: number
  vatCents: number
  totalCents: number
  currency: string
  orderId: string
  /** True when a credit note references this invoice (correctsInvoiceId === id). */
  voided: boolean
  /** The number of the credit note that voided this invoice, or null. */
  rectifiedByNumber: string | null
  /** Credit notes only: the number of the invoice this document rectifies. */
  correctsNumber: string | null
}

export type InvoiceFilter = {
  year?: number
  month?: number
  client?: string
}

/**
 * Query the register: year/month filtered DB-side (indexed), client search
 * in-memory (buyer data lives in the JSON snapshot; volume is small).
 * Ordered correlatively: series → year → month → seq.
 */
export async function queryInvoices(filter: InvoiceFilter = {}): Promise<InvoiceRow[]> {
  const rows = await prisma.invoice.findMany({
    where: {
      ...(filter.year != null ? { year: filter.year } : {}),
      ...(filter.month != null ? { month: filter.month } : {}),
    },
    orderBy: [{ series: 'asc' }, { year: 'asc' }, { month: 'asc' }, { seq: 'asc' }],
    select: {
      id: true,
      number: true,
      type: true,
      issuedAt: true,
      currency: true,
      orderId: true,
      buyerSnapshot: true,
      totalsSnapshot: true,
      correctsInvoice: { select: { number: true } },
      corrections: { select: { number: true }, take: 1 },
    },
  })

  let invoices: InvoiceRow[] = rows.map((r) => {
    const buyer = r.buyerSnapshot as BuyerSnapshot
    const totals = r.totalsSnapshot as TotalsSnapshot
    const rectifiedByNumber = r.type === 'invoice' ? (r.corrections[0]?.number ?? null) : null
    return {
      id: r.id,
      number: r.number,
      type: r.type as 'invoice' | 'credit_note',
      issuedAt: r.issuedAt.toISOString(),
      buyerName: buyer.name ?? '',
      buyerEmail: buyer.email ?? '',
      buyerTaxId: buyer.taxId ?? null,
      vatRatePct: totals.vatRatePct ?? 0,
      baseCents: totals.baseCents,
      vatCents: totals.vatCents,
      totalCents: totals.totalCents,
      currency: totals.currency ?? r.currency,
      orderId: r.orderId,
      voided: rectifiedByNumber !== null,
      rectifiedByNumber,
      correctsNumber: r.type === 'credit_note' ? (r.correctsInvoice?.number ?? null) : null,
    }
  })

  // Client filter — case-insensitive substring match against name OR email
  // (tested separately, so a query spanning the name/email boundary never
  // matches — keep the register, CSV, and ZIP identical here).
  if (filter.client && filter.client.trim()) {
    const q = filter.client.trim().toLowerCase()
    invoices = invoices.filter(
      (inv) => inv.buyerName.toLowerCase().includes(q) || inv.buyerEmail.toLowerCase().includes(q),
    )
  }

  return invoices
}

/**
 * Export filename core, shared by CSV + ZIP so both name periods identically.
 * A client-filtered export is a PARTIAL register and must say so — a file
 * named like the full period that silently contains a subset reads as
 * "numbers are missing" in a later audit.
 */
export function exportPeriodLabel(filter: InvoiceFilter): string {
  const period =
    filter.year != null && filter.month != null
      ? `${filter.year}-${String(filter.month).padStart(2, '0')}`
      : filter.year != null
        ? `${filter.year}`
        : 'all'
  if (filter.client && filter.client.trim()) {
    const slug = filter.client
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    return `${period}-PARTIAL${slug ? `-${slug}` : ''}`
  }
  return period
}
