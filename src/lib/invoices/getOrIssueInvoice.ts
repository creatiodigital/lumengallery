/**
 * AR-131 — Race-safe "exactly one document per (order, type)" issue wrapper.
 *
 * The DB backstop is @@unique([orderId, type]) on Invoice. Two concurrent
 * sendInvoice calls (double-click, two tabs) can both pass an application-level
 * existence check; here the loser's insert hits the unique constraint and is
 * rerouted to the winner's row — the SAME number, never a second one.
 *
 * A P2002 can also come from two first-of-month calls racing to create the
 * counter row (different orders). In that case no (orderId, type) row exists,
 * so we retry the mint once — the counter row exists by then and the retry
 * increments it normally. No gap, no burn, in either case.
 *
 * DB-only (no render/email/R2), so Playwright can exercise the concurrency
 * invariant directly.
 */

import prisma from '@/lib/prisma'
import {
  issueInvoiceRecord,
  type IssueInvoiceInput,
  type IssuedInvoice,
} from './issueInvoiceRecord'

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

export async function getOrIssueInvoice(
  input: IssueInvoiceInput,
): Promise<{ invoice: IssuedInvoice; reused: boolean }> {
  const existing = await prisma.invoice.findFirst({
    where: { orderId: input.orderId, type: input.type },
    orderBy: { issuedAt: 'asc' },
  })
  // Prisma-Json → typed boundary: rows are only ever written by
  // issueInvoiceRecord from the canonical snapshot types.
  if (existing) return { invoice: existing as unknown as IssuedInvoice, reused: true }

  try {
    return { invoice: await issueInvoiceRecord(input), reused: false }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    // Lost a race. If another call minted this order's document, reuse it.
    const winner = await prisma.invoice.findFirst({
      where: { orderId: input.orderId, type: input.type },
      orderBy: { issuedAt: 'asc' },
    })
    if (winner) return { invoice: winner as unknown as IssuedInvoice, reused: true }
    // Otherwise it was the first-of-month counter-row race — one clean retry.
    return { invoice: await issueInvoiceRecord(input), reused: false }
  }
}
