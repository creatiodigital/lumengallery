/**
 * AR-131 — Build and VALIDATE everything an invoice/credit note needs, before
 * any number is minted.
 *
 * Ordering rule: this runs BEFORE issueInvoiceRecord so that a defective
 * document (missing field, empty lines, non-reconciling totals) fails loud and
 * never burns a correlative number. Pure + DB-free, so Playwright can import
 * and test it directly.
 */

import {
  buildInvoiceSnapshots,
  type InvoiceSnapshots,
  type SnapshotOrderLike,
} from './buildInvoiceSnapshots'
import { buildInvoiceLines, type InvoiceLine, type LinesOrderLike } from './buildInvoiceLines'
import { assertMandatoryFields } from './assertMandatoryFields'

export type InvoiceSourceOrder = SnapshotOrderLike & LinesOrderLike

export type PreparedInvoice = {
  snapshots: InvoiceSnapshots
  lines: InvoiceLine[]
}

export function prepareInvoiceIssue(
  order: InvoiceSourceOrder,
  opts: { negate?: boolean; reason?: string } = {},
): PreparedInvoice {
  const snapshots = buildInvoiceSnapshots(order, { negate: opts.negate })
  if (opts.reason?.trim()) {
    snapshots.totalsSnapshot.reason = opts.reason.trim()
  }

  const lines = opts.negate
    ? buildInvoiceLines(order).map((l) => ({
        ...l,
        unitCents: -l.unitCents,
        lineCents: -l.lineCents,
      }))
    : buildInvoiceLines(order)

  assertMandatoryFields(snapshots, lines)

  // Reconciliation: Σ line amounts MUST equal the taxable base. An invoice
  // whose lines don't sum to its own base is invalid for Hacienda — refuse to
  // issue rather than emit an internally inconsistent legal document.
  const sumLineCents = lines.reduce((s, l) => s + l.lineCents, 0)
  if (sumLineCents !== snapshots.totalsSnapshot.baseCents) {
    throw new Error(
      `line items (${sumLineCents}) do not sum to the taxable base (${snapshots.totalsSnapshot.baseCents}) — refusing to issue an inconsistent document`,
    )
  }

  // The stamped VAT rate must match the stored VAT amount (± per-line
  // rounding). Catches orders whose VAT was computed under a different rate
  // (e.g. the old per-country table) being invoiced as if it were 21%.
  const expectedVatCents = Math.round(
    (Math.abs(snapshots.totalsSnapshot.baseCents) * snapshots.totalsSnapshot.vatRatePct) / 100,
  )
  const toleranceCents = lines.length + 1
  if (Math.abs(Math.abs(snapshots.totalsSnapshot.vatCents) - expectedVatCents) > toleranceCents) {
    throw new Error(
      `stored VAT amount (${Math.abs(snapshots.totalsSnapshot.vatCents)}c) does not match the ${snapshots.totalsSnapshot.vatRatePct}% rate on the base (expected ~${expectedVatCents}c) — this order's VAT predates the current rate model; do not invoice it as-is`,
    )
  }

  return { snapshots, lines }
}
