/**
 * AR-131 — Atomically mint a gap-free invoice number and insert the Invoice row.
 *
 * Uses a single Prisma $transaction so the counter increment and the row insert
 * are committed together or rolled back together. Two concurrent first-of-month
 * calls can race on creating the counter row: the loser's transaction aborts
 * with P2002 on the counter PK and rolls back cleanly (no number burned, no
 * gap) — getOrIssueInvoice retries it once. Steady-state increments serialize
 * on the counter row's write lock.
 *
 * The (series, year, month) period is derived in Europe/Madrid — the gallery's
 * tax jurisdiction — so the number's month always matches the Spanish tax
 * period and the date printed on the PDF (which renders in the same zone).
 *
 * NUMBER-BURN RULE: the number lives on the committed Invoice row; a render or
 * email failure that happens AFTER the transaction completes must NOT roll back
 * the number — keep render/email calls outside this function.
 */

import prisma from '@/lib/prisma'
import { seriesFor, formatInvoiceNumber } from './invoiceNumber'
import type { InvoiceSnapshots } from './buildInvoiceSnapshots'
import type { InvoiceLine } from './buildInvoiceLines'

export type IssueInvoiceInput = {
  type: 'invoice' | 'credit_note'
  orderId: string
  currency: string
  /** The r2Key where the PDF will be stored. Pass the pre-built key so the row
   *  ends up with the real key immediately (no later update needed). */
  r2Key: string
  sellerSnapshot: InvoiceSnapshots['sellerSnapshot']
  buyerSnapshot: InvoiceSnapshots['buyerSnapshot']
  totalsSnapshot: InvoiceSnapshots['totalsSnapshot']
  /** Line items frozen at issue time — re-sends render from these, never from
   *  the live order. */
  linesSnapshot: InvoiceLine[]
  /** For credit notes only: the id of the Invoice this corrects. */
  correctsInvoiceId?: string
  /** Override the clock (useful in tests: pin to a fixed month so concurrent
   *  test runs don't collide with real-production invoice counters). */
  now?: Date
}

export type IssuedInvoice = {
  id: string
  orderId: string
  type: string
  series: string
  year: number
  month: number
  seq: number
  number: string
  r2Key: string
  issuedAt: Date
  currency: string
  sellerSnapshot: InvoiceSnapshots['sellerSnapshot']
  buyerSnapshot: InvoiceSnapshots['buyerSnapshot']
  totalsSnapshot: InvoiceSnapshots['totalsSnapshot']
  /** Nullable only for rows created before the column existed (dev data). */
  linesSnapshot: InvoiceLine[] | null
  correctsInvoiceId: string | null
}

/** Year + 1-based month of an instant in the gallery's tax timezone. */
export function madridPeriod(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  return { year, month }
}

export async function issueInvoiceRecord(input: IssueInvoiceInput): Promise<IssuedInvoice> {
  const now = input.now ?? new Date()
  const { year, month } = madridPeriod(now)
  const series = seriesFor(input.type)

  const invoice = await prisma.$transaction(async (tx) => {
    // Upsert the counter: create with lastNumber=1 on first invoice of the
    // month, else increment lastNumber by 1. Returns the updated row.
    const counter = await tx.invoiceCounter.upsert({
      where: { series_year_month: { series, year, month } },
      create: { series, year, month, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const seq = counter.lastNumber
    const number = formatInvoiceNumber(series, year, month, seq)

    const row = await tx.invoice.create({
      data: {
        orderId: input.orderId,
        type: input.type,
        series,
        year,
        month,
        seq,
        number,
        r2Key: input.r2Key,
        currency: input.currency,
        issuedAt: now,
        sellerSnapshot: input.sellerSnapshot as object,
        buyerSnapshot: input.buyerSnapshot as object,
        totalsSnapshot: input.totalsSnapshot as object,
        linesSnapshot: input.linesSnapshot as unknown as object,
        ...(input.correctsInvoiceId ? { correctsInvoiceId: input.correctsInvoiceId } : {}),
      },
    })

    return row
  })

  // Single Json→typed boundary: the row's snapshot columns are Prisma Json,
  // but they were written THIS call from the typed input above, so the cast
  // is re-asserting what the compiler just checked.
  return invoice as unknown as IssuedInvoice
}
