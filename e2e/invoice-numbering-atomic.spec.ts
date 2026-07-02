import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { issueInvoiceRecord } from '@/lib/invoices/issueInvoiceRecord'
import { getOrIssueInvoice } from '@/lib/invoices/getOrIssueInvoice'
import { seriesFor } from '@/lib/invoices/invoiceNumber'

import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * AR-131 — Atomic, gap-free, race-safe invoice numbering.
 *
 * Test 1 (counter linearization): issue invoices for 3 different orders
 * CONCURRENTLY and assert seq values are exactly [1,2,3] — no gaps, no dupes.
 *
 * Test 2 (per-order idempotency under race — the double-click case): fire 5
 * concurrent getOrIssueInvoice calls for ONE order and assert exactly one
 * Invoice row exists and every call returned the SAME number. This is
 * enforced at the DB level by @@unique([orderId, type]); before that
 * constraint existed, this exact scenario minted multiple legal numbers for
 * one sale.
 *
 * A fixed future date (2099-01-15 UTC) is used as `now` so the counter for
 * that (series, year=2099, month=1) namespace is isolated from production
 * data and any other test. The counter is deleted in teardown.
 *
 * TEARDOWN ORDER (mandatory — Invoice.orderId FK is onDelete: Restrict):
 *   1. prisma.invoice.deleteMany for the order
 *   2. prisma.invoiceCounter.deleteMany({ where: { year: 2099 } })
 *   3. order teardown helper (releases edition number, voids PI, deletes order)
 */

const NOW = new Date(Date.UTC(2099, 0, 15)) // 2099-01-15 UTC
const YEAR = 2099
const SERIES = seriesFor('invoice')

// Minimal snapshots — content doesn't matter for these tests, only numbering.
const fakeSnapshot = {
  sellerSnapshot: {
    legalName: 'Test Gallery SL',
    nif: 'ESB00000000',
    addressLines: ['Test Street 1', 'Test City'],
    email: 'test@test.com',
    phone: '+34 000 000 000',
    website: 'https://test.com',
  },
  buyerSnapshot: {
    name: 'Test Buyer',
    email: 'buyer@test.com',
    company: null,
    taxId: null,
    addressLines: ['Buyer Street 1', 'Buyer City'],
    countryCode: 'ES',
  },
  totalsSnapshot: {
    currency: 'eur',
    baseCents: 5000,
    vatRatePct: 21,
    vatCents: 1050,
    totalCents: 6050,
  },
  linesSnapshot: [{ description: 'Test artwork', qty: 1, unitCents: 5000, lineCents: 5000 }],
}

async function teardownInvoicesThenOrder(bought: BoughtLimitedOrder): Promise<void> {
  // TEARDOWN ORDER: invoices → counters → order (FK constraint requires it).
  try {
    await prisma.invoice.deleteMany({ where: { orderId: bought.orderId } })
  } catch (err) {
    console.warn('[invoice-numbering-atomic] invoice deleteMany failed:', err)
  }
  try {
    await prisma.invoiceCounter.deleteMany({ where: { year: YEAR } })
  } catch (err) {
    console.warn('[invoice-numbering-atomic] counter deleteMany failed:', err)
  }
  await teardownBoughtOrder(bought)
}

test.describe('Invoice numbering — atomic, gap-free, race-safe', () => {
  // No browser session needed — this spec is entirely in-process.
  test.use({ storageState: undefined as unknown as string })

  test('concurrent issues across 3 orders produce seq [1,2,3] with no gaps or dupes', async () => {
    test.setTimeout(180_000)

    const orders: BoughtLimitedOrder[] = []
    try {
      // Three real throwaway orders (@@unique([orderId, type]) allows only ONE
      // invoice per order, so gap-free concurrency needs distinct orders).
      for (let i = 0; i < 3; i++) {
        orders.push(await buyOneLimited({ editionSize: 5, tag: `inv-atomic-${i}` }))
      }

      // Issue the 3 invoices CONCURRENTLY — all against the (AR, 2099, 1) counter.
      const results = await Promise.all(
        orders.map((o, i) =>
          issueInvoiceRecord({
            type: 'invoice',
            orderId: o.orderId,
            currency: 'eur',
            r2Key: `staging/invoices/e2e-atomic-${i}-${Date.now()}.pdf`,
            ...fakeSnapshot,
            now: NOW,
          }),
        ),
      )

      const seqs = results.map((r) => r.seq).sort((a, b) => a - b)
      expect(seqs, 'seq values must be exactly [1,2,3] — atomic, no gaps or duplicates').toEqual([
        1, 2, 3,
      ])

      for (const r of results) {
        expect(r.number).toMatch(/^AR-01-2099-\d{3}$/)
        expect(r.series).toBe(SERIES)
        expect(r.year).toBe(YEAR)
        expect(r.month).toBe(1)
      }
    } finally {
      for (const o of orders) await teardownInvoicesThenOrder(o)
    }
  })

  test('5 concurrent getOrIssueInvoice calls for ONE order mint exactly one number', async () => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 5, tag: 'inv-race' })
      const orderId = bought.orderId

      // The double-click / two-tab race: all 5 must converge on ONE document.
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          getOrIssueInvoice({
            type: 'invoice',
            orderId,
            currency: 'eur',
            r2Key: `staging/invoices/e2e-race-${i}-${Date.now()}.pdf`,
            ...fakeSnapshot,
            now: NOW,
          }),
        ),
      )

      const numbers = new Set(results.map((r) => r.invoice.number))
      expect(numbers.size, 'every concurrent call must return the SAME number').toBe(1)

      const rowCount = await prisma.invoice.count({ where: { orderId, type: 'invoice' } })
      expect(rowCount, 'exactly ONE invoice row may exist for the order').toBe(1)

      const minted = results.filter((r) => !r.reused)
      expect(minted.length, 'at most one call may report a fresh mint').toBeLessThanOrEqual(1)

      // The counter must not have burned numbers for the losers: the single
      // row's seq is 1 OR the counter advanced only for genuinely minted rows.
      const row = await prisma.invoice.findFirst({ where: { orderId, type: 'invoice' } })
      expect(row?.seq).toBe(1)
    } finally {
      if (bought) await teardownInvoicesThenOrder(bought)
    }
  })
})
