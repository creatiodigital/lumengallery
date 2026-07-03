'use server'

/**
 * Dev/staging-ONLY cleanup actions for clearing test noise off the admin
 * dashboard. Every action is double-gated: requireAdminAction (auth) AND
 * devCleanupAllowed (NEXT_PUBLIC_APP_ENV !== 'production'). In production
 * these return an error without touching anything — issued invoices are
 * legal documents there and orders are business records.
 */
import { requireAdminAction } from '@/lib/authUtils'
import {
  countTestData,
  devCleanupAllowed,
  resetTestData,
  type ResetTestDataSummary,
  type TestDataCounts,
} from '@/lib/admin/resetTestData'

const PROD_ERROR = 'Dev cleanup is disabled in production.'

/** Counts for the confirm dialog — what a full reset would remove. */
export async function getTestDataCounts(): Promise<
  { ok: true; counts: TestDataCounts } | { ok: false; error: string }
> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  if (!devCleanupAllowed()) return { ok: false, error: PROD_ERROR }
  try {
    return { ok: true, counts: await countTestData() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to count test data.' }
  }
}

/**
 * Wipe ALL test orders, invoices (+ R2 PDFs), counters and staged carts, and
 * reset every limited-edition series to a clean, fully-available 1..N.
 */
export async function clearAllTestData(): Promise<
  { ok: true; summary: ResetTestDataSummary } | { ok: false; error: string }
> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  if (!devCleanupAllowed()) return { ok: false, error: PROD_ERROR }
  try {
    const summary = await resetTestData()
    return { ok: true, summary }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Reset failed.' }
  }
}

// NOTE: deliberately NO per-invoice delete action. The ORDER is king — an
// invoice only ever leaves the register because its order was deleted
// (dev/staging cascade in deleteOrder) or via the full wipe above. A
// standalone invoice delete would let the register and the orders list drift.
