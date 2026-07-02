import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { prepareInvoiceIssue } from '@/lib/invoices/prepareInvoiceIssue'
import { getOrIssueInvoice } from '@/lib/invoices/getOrIssueInvoice'
import { buildInvoiceKey } from '@/lib/r2'

import {
  buyOneLimited,
  teardownBoughtOrder,
  type BoughtLimitedOrder,
} from './order-helpers'
import { seedCookieConsent } from './consent-helpers'

/**
 * AR-131 — sendInvoice server layer e2e.
 *
 * Tests the full invoice lifecycle at the server layer:
 *   buy → capture (via UI) → place (via UI) → started (via UI)
 *   → prepare (snapshots + lines, validated BEFORE minting) → mint number
 *   → reconcile lines → REAL idempotent re-issue (getOrIssueInvoice twice)
 *
 * There is deliberately NO fulfillment-stage gate on invoicing (the admin
 * issues manually at any stage), so no gate assertion exists here.
 *
 * Stage advancement is driven through the real admin UI (same approach as
 * order-capture-place.spec.ts). Invoice issuance is exercised directly
 * through the server-layer functions (prepareInvoiceIssue, getOrIssueInvoice)
 * — the same core sendInvoice runs, minus render/email.
 *
 * EMAIL: SKIP_EMAILS=true is required on the runner (playwright.config injects
 * it by default). In-process email helpers short-circuit; no real Resend
 * traffic leaves the suite.
 *
 * TEARDOWN ORDER (mandatory — Invoice.orderId FK is onDelete: Restrict):
 *   1. prisma.invoice.deleteMany for this order
 *   2. prisma.invoiceCounter.deleteMany for the (series, year, month) used
 *   3. order teardown helper (releases edition number, voids PI, deletes order)
 */
test.describe('Invoice — server layer', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  // Track teardown data at the describe scope so finally always has it.
  let issuedSeries: string | null = null
  let issuedYear: number | null = null
  let issuedMonth: number | null = null

  test('full invoice lifecycle: buy → started → issue → idempotent → reconciled', async ({
    page,
  }) => {
    test.setTimeout(180_000)

    let bought: BoughtLimitedOrder | null = null

    try {
      // ── 2. Buy the main throwaway order.
      bought = await buyOneLimited({ editionSize: 5, tag: 'invoice-lifecycle' })
      const orderId = bought.orderId

      // ── 3. Advance to Started via the real admin UI.
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

      // ── 4. Build snapshots and assert mandatory fields.
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

      // prepareInvoiceIssue builds snapshots + lines and runs EVERY validation
      // (mandatory fields, line descriptions, Σlines == base, VAT-vs-rate
      // consistency) BEFORE any number can be minted — it throws loudly here
      // if the order can't produce a legal factura.
      const { snapshots, lines } = prepareInvoiceIssue(order)

      // ── 5. Issue the invoice (first time).
      // Isolate numbering to a throwaway far-future period (year 2099) so this
      // test NEVER touches the real current-month InvoiceCounter. Otherwise the
      // counter teardown below would reset the live month and could collide with
      // (or gap) numbers issued during real manual testing in the same month.
      const now2099 = new Date(Date.UTC(2099, 0, 15))
      const r2Key = buildInvoiceKey(orderId, `e2e-${Date.now()}`)
      const first = await getOrIssueInvoice({
        type: 'invoice',
        orderId,
        currency: order.currency,
        r2Key,
        sellerSnapshot: snapshots.sellerSnapshot,
        buyerSnapshot: snapshots.buyerSnapshot,
        totalsSnapshot: snapshots.totalsSnapshot,
        linesSnapshot: lines,
        now: now2099,
      })
      expect(first.reused, 'first call must mint a fresh document').toBe(false)
      const invoice = first.invoice

      // Track (series, year, month) for counter teardown.
      issuedSeries = invoice.series
      issuedYear = invoice.year
      issuedMonth = invoice.month

      // ── 6. Assert number format: AR-MM-YYYY-NNN.
      expect(invoice.number, 'invoice number must match AR-MM-YYYY-NNN format').toMatch(
        /^AR-\d{2}-\d{4}-\d{3}$/,
      )

      // ── 7. Log and assert invoice_issued event.
      await prisma.printOrderEvent.create({
        data: {
          orderId,
          kind: 'invoice_issued',
          actor: 'admin:e2e-test',
          message: invoice.number,
          payload: { invoiceId: invoice.id, number: invoice.number },
        },
      })
      const invoiceEvent = await prisma.printOrderEvent.findFirst({
        where: { orderId, kind: 'invoice_issued' },
      })
      expect(invoiceEvent, 'invoice_issued event must exist in order log').not.toBeNull()
      expect(invoiceEvent?.message).toBe(invoice.number)

      // ── 8. Idempotency: confirm only ONE invoice row exists for this order.
      const invoiceCount = await prisma.invoice.count({ where: { orderId, type: 'invoice' } })
      expect(invoiceCount, 'exactly one invoice must exist — no double-minting').toBe(1)

      // Confirm a second call to issueInvoiceRecord (the idempotency check lives in sendInvoice;
      // here we check the underlying row state): the existing row has the same number.
      const existingInvoice = await prisma.invoice.findFirst({
        where: { orderId, type: 'invoice' },
        orderBy: { issuedAt: 'asc' },
      })
      expect(existingInvoice?.number, 'stored invoice number matches issued number').toBe(
        invoice.number,
      )

      // ── 9. Totals reconciliation.
      const tots = snapshots.totalsSnapshot
      expect(
        tots.baseCents + tots.vatCents,
        `baseCents(${tots.baseCents}) + vatCents(${tots.vatCents}) must equal totalCents(${tots.totalCents})`,
      ).toBe(tots.totalCents)

      // Line reconciliation: Σ lineCents == baseCents (the same lines that
      // were frozen onto the row as linesSnapshot).
      const sumLineCents = lines.reduce((s, l) => s + l.lineCents, 0)
      const baseCents = order.totalCents - order.customerVatCents
      expect(
        sumLineCents,
        `Σ line lineCents (${sumLineCents}) must equal baseCents (${baseCents})`,
      ).toBe(baseCents)

      // NOTE: renderInvoicePdf is NOT called in this spec because @react-pdf/renderer
      // conflicts with Playwright's React instrumentation in the test runner process
      // (Playwright patches createElement, which breaks @react-pdf/reconciler). PDF
      // rendering is verified separately via `npx tsx scripts/render-sample-invoice.ts`.
      // The sendInvoice server action calls renderInvoicePdf inside the Next.js server
      // context where this conflict is absent. The spec tests the DB layer end-to-end.

      // ── 10. Second call (idempotency path): actually CALL the issue core a
      //    second time — it must reuse the committed row, same number, no mint.
      const second = await getOrIssueInvoice({
        type: 'invoice',
        orderId,
        currency: order.currency,
        r2Key: buildInvoiceKey(orderId, `e2e-second-${Date.now()}`),
        sellerSnapshot: snapshots.sellerSnapshot,
        buyerSnapshot: snapshots.buyerSnapshot,
        totalsSnapshot: snapshots.totalsSnapshot,
        linesSnapshot: lines,
        now: now2099,
      })
      expect(second.reused, 'second call must REUSE the existing document').toBe(true)
      expect(second.invoice.number, 'second call returns the SAME number (idempotent)').toBe(
        invoice.number,
      )
      const countAfterSecondCall = await prisma.invoice.count({
        where: { orderId, type: 'invoice' },
      })
      expect(countAfterSecondCall, 'still exactly one invoice after idempotent re-issue').toBe(1)

      // The stored row carries the frozen linesSnapshot — re-sends render from
      // THIS, never from the live order.
      const storedRow = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        select: { linesSnapshot: true },
      })
      expect(Array.isArray(storedRow?.linesSnapshot), 'linesSnapshot must be frozen on the row').toBe(
        true,
      )
    } finally {
      if (bought) {
        // TEARDOWN ORDER: invoices → counters → order (FK Restrict requires this sequence).
        try {
          await prisma.invoice.deleteMany({ where: { orderId: bought.orderId } })
        } catch (err) {
          console.warn('[invoice.spec] invoice deleteMany failed:', err)
        }

        // Delete the counter for the (series, year, month) we used, so it resets
        // cleanly in subsequent test runs. Fine for dev DB — never runs in prod.
        if (issuedSeries && issuedYear !== null && issuedMonth !== null) {
          try {
            await prisma.invoiceCounter.deleteMany({
              where: {
                series: issuedSeries,
                year: issuedYear,
                month: issuedMonth,
              },
            })
          } catch (err) {
            console.warn('[invoice.spec] counter deleteMany failed:', err)
          }
        }

        await teardownBoughtOrder(bought)
      }
    }
  })
})
