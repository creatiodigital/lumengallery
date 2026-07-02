import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { buildInvoiceSnapshots } from '@/lib/invoices/buildInvoiceSnapshots'
import { assertMandatoryFields } from '@/lib/invoices/assertMandatoryFields'
import { issueInvoiceRecord } from '@/lib/invoices/issueInvoiceRecord'
import { buildInvoiceLines } from '@/lib/invoices/buildInvoiceLines'
import { buildInvoiceKey } from '@/lib/r2'

import {
  buyOneLimited,
  teardownBoughtOrder,
  type BoughtLimitedOrder,
} from './order-helpers'
import { seedCookieConsent } from './consent-helpers'

/**
 * AR-131 — issueCreditNote server layer e2e.
 *
 * Tests the credit note lifecycle at the DB layer (no react-pdf, no email):
 *   buy → advance to Started via UI → issue invoice (AR series, year 2099)
 *   → issue credit note (AR-R series, year 2099)
 *   → assert: number format, negated amounts, correctsInvoiceId link
 *   → assert idempotency: only one credit note row
 *
 * Uses `now: new Date(Date.UTC(2099, 0, 15))` to avoid touching real counters.
 *
 * TEARDOWN ORDER (Invoice.orderId FK is onDelete: Restrict):
 *   1. prisma.invoice.deleteMany for this order
 *   2. prisma.invoiceCounter.deleteMany for the (series, year, month) used (2099-01)
 *   3. teardownBoughtOrder (releases edition number, voids PI, deletes order)
 */
test.describe('Credit note — server layer', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  // Track issued counters for teardown — populated when rows are minted.
  const issuedSeries: string[] = []
  let issuedYear: number | null = null
  let issuedMonth: number | null = null

  test('full credit note lifecycle: buy → started → invoice → credit note → idempotent', async ({
    page,
  }) => {
    test.setTimeout(180_000)

    let bought: BoughtLimitedOrder | null = null

    try {
      // ── 1. Buy a throwaway limited order.
      bought = await buyOneLimited({ editionSize: 5, tag: 'credit-note-lifecycle' })
      const orderId = bought.orderId

      // ── 2. Advance to Started via the real admin UI.
      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${orderId}`)

      // Step ①: Capture payment.
      await page.getByRole('button', { name: /Capture payment/i }).click()
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: orderId },
              select: { paymentStatus: true },
            })
            return o?.paymentStatus
          },
          { message: 'capture should succeed', timeout: 20_000 },
        )
        .toBe('succeeded')

      // Step ②: Mark placed at TPS.
      await page.getByRole('button', { name: /Mark placed at TPS/i }).click()
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: orderId },
              select: { fulfillmentStatus: true },
            })
            return o?.fulfillmentStatus
          },
          { message: 'should advance to Placed', timeout: 20_000 },
        )
        .toBe('Placed')

      // Step ③: Mark in production (Started).
      await page.getByRole('button', { name: /Mark in production/i }).click()
      await expect
        .poll(
          async () => {
            const o = await prisma.printOrder.findUnique({
              where: { id: orderId },
              select: { fulfillmentStatus: true },
            })
            return o?.fulfillmentStatus
          },
          { message: 'should advance to Started', timeout: 20_000 },
        )
        .toBe('Started')

      // ── 3. Load the order with everything needed for invoicing.
      const order = await prisma.printOrder.findUnique({
        where: { id: orderId },
        include: {
          artwork: { select: { title: true, slug: true } },
          items: {
            include: { artwork: { select: { title: true, slug: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      expect(order, 'order must exist in DB').not.toBeNull()
      if (!order) throw new Error('unreachable')

      const now2099 = new Date(Date.UTC(2099, 0, 15))

      // Lines are frozen on the row at issue time (linesSnapshot) — build the
      // positive + negated sets up front for both documents.
      const positiveLines = buildInvoiceLines({
        totalCents: order.totalCents,
        customerVatCents: order.customerVatCents,
        productionCents: order.productionCents,
        productionShippingCents: order.productionShippingCents,
        galleryCents: order.galleryCents,
        artistCents: order.artistCents,
        artwork: order.artwork,
        items: order.items,
      })
      const negatedLines = positiveLines.map((l) => ({
        ...l,
        unitCents: -l.unitCents,
        lineCents: -l.lineCents,
      }))

      // ── 4. Issue the original invoice (AR series, 2099-01).
      const snapshots = buildInvoiceSnapshots(order)
      assertMandatoryFields(snapshots, positiveLines)

      const invoiceR2Key = buildInvoiceKey(orderId, `e2e-invoice-${Date.now()}`)
      const invoice = await issueInvoiceRecord({
        type: 'invoice',
        orderId,
        currency: order.currency,
        r2Key: invoiceR2Key,
        sellerSnapshot: snapshots.sellerSnapshot,
        buyerSnapshot: snapshots.buyerSnapshot,
        totalsSnapshot: snapshots.totalsSnapshot,
        linesSnapshot: positiveLines,
        now: now2099,
      })

      // Track for teardown.
      issuedSeries.push(invoice.series)
      issuedYear = invoice.year
      issuedMonth = invoice.month

      // Assert invoice number format: AR-MM-YYYY-NNN.
      expect(invoice.number, 'invoice number must match AR-MM-YYYY-NNN').toMatch(
        /^AR-\d{2}-\d{4}-\d{3}$/,
      )

      // ── 5. Build negated snapshots for the credit note.
      const negatedSnapshots = buildInvoiceSnapshots(order, { negate: true })

      // Attach a reason to the totalsSnapshot (stored in JSON, no schema column).
      const testReason = 'E2E test credit note'
      negatedSnapshots.totalsSnapshot.reason = testReason

      assertMandatoryFields(negatedSnapshots, negatedLines)

      // ── 6. Issue the credit note (AR-R series, 2099-01).
      const cnR2Key = buildInvoiceKey(orderId, `e2e-cn-${Date.now()}`)
      const creditNote = await issueInvoiceRecord({
        type: 'credit_note',
        orderId,
        currency: order.currency,
        r2Key: cnR2Key,
        sellerSnapshot: negatedSnapshots.sellerSnapshot,
        buyerSnapshot: negatedSnapshots.buyerSnapshot,
        totalsSnapshot: negatedSnapshots.totalsSnapshot,
        linesSnapshot: negatedLines,
        correctsInvoiceId: invoice.id,
        now: now2099,
      })

      // Track the AR-R series for teardown too.
      if (!issuedSeries.includes(creditNote.series)) {
        issuedSeries.push(creditNote.series)
      }

      // ── 7. Assert credit note number format: AR-R-MM-YYYY-NNN.
      expect(creditNote.number, 'credit note number must match AR-R-MM-YYYY-NNN').toMatch(
        /^AR-R-\d{2}-\d{4}-\d{3}$/,
      )

      // ── 8. Assert negated amounts are exact negatives of the invoice amounts.
      const invTotals = snapshots.totalsSnapshot
      const cnTotals = negatedSnapshots.totalsSnapshot

      expect(cnTotals.baseCents, 'baseCents must be negated').toBe(-invTotals.baseCents)
      expect(cnTotals.vatCents, 'vatCents must be negated').toBe(-invTotals.vatCents)
      expect(cnTotals.totalCents, 'totalCents must be negated').toBe(-invTotals.totalCents)

      // ── 9. Assert correctsInvoiceId links to the original.
      expect(creditNote.correctsInvoiceId, 'credit note must reference the original invoice').toBe(
        invoice.id,
      )

      // ── 10. Assert reason is stored in the totalsSnapshot.
      const storedCn = await prisma.invoice.findUnique({
        where: { id: creditNote.id },
        select: { totalsSnapshot: true, correctsInvoiceId: true },
      })
      expect(storedCn, 'credit note row must exist in DB').not.toBeNull()
      const storedTotals = storedCn?.totalsSnapshot as Record<string, unknown>
      expect(storedTotals?.reason, 'reason must be stored in totalsSnapshot').toBe(testReason)
      expect(storedCn?.correctsInvoiceId, 'DB row must link to original invoice').toBe(invoice.id)

      // ── 11. Idempotency: only one credit note row for this order.
      const cnCount = await prisma.invoice.count({
        where: { orderId, type: 'credit_note' },
      })
      expect(cnCount, 'exactly one credit note must exist — no double-minting').toBe(1)

      // ── 12. Negated lines sanity check (same lines frozen on the row above).
      const sumNegatedLineCents = negatedLines.reduce((s, l) => s + l.lineCents, 0)
      expect(
        sumNegatedLineCents,
        `Σ negated line lineCents (${sumNegatedLineCents}) must equal negated baseCents (${cnTotals.baseCents})`,
      ).toBe(cnTotals.baseCents)

      // NOTE: renderInvoicePdf is NOT called in this spec (same reason as invoice.spec.ts:
      // @react-pdf/renderer conflicts with Playwright's React instrumentation in the runner).
    } finally {
      if (bought) {
        // TEARDOWN ORDER (FK Restrict requires invoices deleted first):
        //   1. Delete all invoice rows for this order.
        try {
          await prisma.invoice.deleteMany({ where: { orderId: bought.orderId } })
        } catch (err) {
          console.warn('[credit-note.spec] invoice deleteMany failed:', err)
        }

        //   2. Delete InvoiceCounter rows for the (series, year, month) used (2099-01).
        //      Safe for dev DB; never touches real counters.
        if (issuedYear !== null && issuedMonth !== null && issuedSeries.length > 0) {
          try {
            await prisma.invoiceCounter.deleteMany({
              where: {
                series: { in: issuedSeries },
                year: issuedYear,
                month: issuedMonth,
              },
            })
          } catch (err) {
            console.warn('[credit-note.spec] counter deleteMany failed:', err)
          }
        }

        //   3. Order teardown (releases edition number, voids PI, deletes order).
        await teardownBoughtOrder(bought)
      }
    }
  })
})
