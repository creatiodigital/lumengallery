'use server'

import { requireAdminAction } from '@/lib/authUtils'
import { invoiceRegisterToCsv } from '@/lib/invoices/invoiceCsv'
import {
  queryInvoices,
  exportPeriodLabel,
  type InvoiceFilter,
  type InvoiceRow,
} from '@/lib/invoices/queryInvoices'

// NOTE: 'use server' modules may only export async functions — the InvoiceRow
// + InvoiceFilter types live in @/lib/invoices/queryInvoices (next to the
// shared query), import them from there.

/**
 * List invoices for the register page — a thin admin-guarded wrapper around
 * the shared queryInvoices helper (which the ZIP route uses too).
 */
export async function listInvoices(
  filter: InvoiceFilter = {},
): Promise<{ ok: true; invoices: InvoiceRow[] } | { ok: false; error: string }> {
  const guard = await requireAdminAction()
  if (!guard.ok) return guard

  return { ok: true, invoices: await queryInvoices(filter) }
}

/**
 * Build a CSV of the invoice register for the given filter and return it
 * as a plain string. The client receives { filename, csv } and triggers
 * a browser download via Blob + anchor. A client-filtered export is named
 * `…-PARTIAL-…` — it is not the period's full register.
 */
export async function exportInvoiceRegisterCsv(
  filter: InvoiceFilter = {},
): Promise<{ ok: true; filename: string; csv: string } | { ok: false; error: string }> {
  const guard = await requireAdminAction()
  if (!guard.ok) return guard

  const invoices = await queryInvoices(filter)
  const csv = invoiceRegisterToCsv(invoices)
  const filename = `AR-register-${exportPeriodLabel(filter)}.csv`

  return { ok: true, filename, csv }
}
