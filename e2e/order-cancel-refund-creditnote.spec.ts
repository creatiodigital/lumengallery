import { test, expect } from '@playwright/test'

import { assertMandatoryFields } from '@/lib/invoices/assertMandatoryFields'
import { buildInvoiceLines } from '@/lib/invoices/buildInvoiceLines'
import { buildInvoiceSnapshots } from '@/lib/invoices/buildInvoiceSnapshots'
import { issueInvoiceRecord } from '@/lib/invoices/issueInvoiceRecord'
import prisma from '@/lib/prisma'
import { buildInvoiceKey } from '@/lib/r2'
import { stripe } from '@/lib/stripe/client'

import { seedCookieConsent } from './consent-helpers'
import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'

/**
 * The full CANCEL-AN-ORDER money chain, end to end:
 *
 *   buy → capture (charge moves) → place → production Started
 *   → issue invoice → REFUND through the real admin UI
 *   → credit note issued as the invoice's exact negative.
 *
 * Two gaps this closes that the sibling specs leave open:
 *  1. order-refund.spec only refunds an AUTHORIZED order (PI cancel — no money
 *     ever moved). Here the order is CAPTURED first, so `refundOrder` takes
 *     the other branch: a real `stripe.refunds.create` returning captured
 *     money. That is the branch a live "cancel my order" support case hits.
 *  2. refund and credit note were tested in isolation (order-refund /
 *     credit-note specs); the staging QA scenario treats them as ONE chain.
 *
 * Also asserts the production-start edition policy: the order reached
 * 'Started' before the refund, so a physical numbered print exists — the
 * number must be RETAINED (never returned to the pool for a second buyer),
 * with the retention logged for the audit trail.
 *
 * Invoices use `now: 2099-01` so real fiscal counters are never touched
 * (same convention as credit-note.spec). Emails are gated by SKIP_EMAILS on
 * the dev server ([[feedback_no_emails_in_e2e]]). Throwaway fixture; the
 * teardown order respects Invoice.orderId's onDelete: Restrict.
 */
test.describe('Cancel/refund → credit note — full chain (captured order)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  const issuedSeries: string[] = []
  let issuedYear: number | null = null
  let issuedMonth: number | null = null

  test('captured+Started order: UI refund moves money back, retains the edition number, and the credit note negates the invoice', async ({
    page,
  }) => {
    test.setTimeout(180_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      // ── 1. Buy a throwaway limited order (authorized, number 1/5 bound). ──
      bought = await buyOneLimited({ editionSize: 5, tag: 'refund-cn-chain' })
      const orderId = bought.orderId

      // ── 2. Capture → Placed → Started via the real admin UI. ─────────────
      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${orderId}`)

      await page.getByRole('button', { name: /Capture payment/i }).click()
      await expect
        .poll(
          async () =>
            (
              await prisma.printOrder.findUnique({
                where: { id: orderId },
                select: { paymentStatus: true },
              })
            )?.paymentStatus,
          { message: 'capture should succeed', timeout: 20_000 },
        )
        .toBe('succeeded')

      // Capture flips the ledger: the buyer's number is now SOLD. Poll, not a
      // one-shot read — capturePayment stamps paymentStatus first and marks
      // the number sold as its NEXT write, so reading the ledger the instant
      // the status flips can land between the two statements.
      await expect
        .poll(
          async () =>
            (
              await prisma.editionNumber.findFirst({
                where: { variantId: bought.fixture.variantId, number: bought.number },
                select: { state: true },
              })
            )?.state,
          { message: 'captured order marks its number sold', timeout: 15_000 },
        )
        .toBe('sold')

      await page.getByRole('button', { name: /Mark placed at TPS/i }).click()
      await expect
        .poll(
          async () =>
            (
              await prisma.printOrder.findUnique({
                where: { id: orderId },
                select: { fulfillmentStatus: true },
              })
            )?.fulfillmentStatus,
          { message: 'should advance to Placed', timeout: 20_000 },
        )
        .toBe('Placed')

      await page.getByRole('button', { name: /Mark in production/i }).click()
      await expect
        .poll(
          async () =>
            (
              await prisma.printOrder.findUnique({
                where: { id: orderId },
                select: { fulfillmentStatus: true },
              })
            )?.fulfillmentStatus,
          { message: 'should advance to Started', timeout: 20_000 },
        )
        .toBe('Started')

      // ── 3. Issue the invoice (server layer, 2099 counters). ──────────────
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
      const snapshots = buildInvoiceSnapshots(order)
      assertMandatoryFields(snapshots, positiveLines)

      const invoice = await issueInvoiceRecord({
        type: 'invoice',
        orderId,
        currency: order.currency,
        r2Key: buildInvoiceKey(orderId, `e2e-chain-invoice-${Date.now()}`),
        sellerSnapshot: snapshots.sellerSnapshot,
        buyerSnapshot: snapshots.buyerSnapshot,
        totalsSnapshot: snapshots.totalsSnapshot,
        linesSnapshot: positiveLines,
        now: now2099,
      })
      issuedSeries.push(invoice.series)
      issuedYear = invoice.year
      issuedMonth = invoice.month
      expect(invoice.number).toMatch(/^AR-\d{2}-\d{4}-\d{3}$/)

      // ── 4. Refund through the real admin UI (CAPTURED branch). ───────────
      await page.reload()
      await page.getByRole('button', { name: /Refund buyer/ }).click()
      await page.getByLabel(/Reason/).fill('e2e chain test — buyer cancelled after production start')
      await page.getByRole('button', { name: 'Issue refund' }).click()
      await page.getByRole('button', { name: 'Yes, refund buyer' }).click()

      await expect
        .poll(
          async () =>
            (
              await prisma.printOrder.findUnique({
                where: { id: orderId },
                select: { paymentStatus: true },
              })
            )?.paymentStatus,
          { message: 'order should become refunded', timeout: 20_000 },
        )
        .toBe('refunded')

      // Money truth: a real Stripe REFUND exists for the full total (this is
      // the captured branch — not a PI cancel, which order-refund.spec covers).
      const refunds = await stripe.refunds.list({
        payment_intent: bought.paymentIntentId,
        limit: 10,
      })
      expect(refunds.data, 'exactly one Stripe refund issued').toHaveLength(1)
      expect(refunds.data[0].amount, 'refund returns the full charge').toBe(bought.totalCents)

      // ── 5. Edition policy: production had Started → the number is RETAINED.
      // A physical print numbered e.g. 1/5 exists; returning it to the pool
      // would sell a second physical copy of the same number.
      const afterRefund = await prisma.editionNumber.findFirst({
        where: { variantId: bought.fixture.variantId, number: bought.number },
        select: { state: true },
      })
      expect(afterRefund?.state, 'number stays sold — NOT back in the pool').toBe('sold')

      // Poll: refundOrder logs this event AFTER stamping paymentStatus, so a
      // one-shot read right after the status poll can race the write.
      await expect
        .poll(
          async () =>
            prisma.printOrderEvent.count({
              where: {
                orderId,
                kind: 'admin_action',
                message: { contains: 'Edition number retained' },
              },
            }),
          { message: 'the retention is logged for the audit trail', timeout: 15_000 },
        )
        .toBe(1)

      // ── 6. Credit note: the invoice's exact negative, linked, idempotent. ─
      const negatedLines = positiveLines.map((l) => ({
        ...l,
        unitCents: -l.unitCents,
        lineCents: -l.lineCents,
      }))
      const negatedSnapshots = buildInvoiceSnapshots(order, { negate: true })
      negatedSnapshots.totalsSnapshot.reason = 'e2e chain test — refund after production start'
      assertMandatoryFields(negatedSnapshots, negatedLines)

      const creditNote = await issueInvoiceRecord({
        type: 'credit_note',
        orderId,
        currency: order.currency,
        r2Key: buildInvoiceKey(orderId, `e2e-chain-cn-${Date.now()}`),
        sellerSnapshot: negatedSnapshots.sellerSnapshot,
        buyerSnapshot: negatedSnapshots.buyerSnapshot,
        totalsSnapshot: negatedSnapshots.totalsSnapshot,
        linesSnapshot: negatedLines,
        correctsInvoiceId: invoice.id,
        now: now2099,
      })
      if (!issuedSeries.includes(creditNote.series)) issuedSeries.push(creditNote.series)

      expect(creditNote.number, 'credit note carries the AR-R series').toMatch(
        /^AR-R-\d{2}-\d{4}-\d{3}$/,
      )
      expect(creditNote.correctsInvoiceId, 'linked to the invoice it corrects').toBe(invoice.id)
      expect(negatedSnapshots.totalsSnapshot.totalCents, 'credit note negates the total').toBe(
        -snapshots.totalsSnapshot.totalCents,
      )
      // And the refund the buyer received equals the credit note's magnitude —
      // the fiscal paper trail matches the money that actually moved.
      expect(refunds.data[0].amount).toBe(-negatedSnapshots.totalsSnapshot.totalCents)

      const cnCount = await prisma.invoice.count({ where: { orderId, type: 'credit_note' } })
      expect(cnCount, 'exactly one credit note — no double-minting').toBe(1)
    } finally {
      if (bought) {
        // Invoice rows first (Invoice.orderId is onDelete: Restrict) …
        try {
          await prisma.invoice.deleteMany({ where: { orderId: bought.orderId } })
        } catch (err) {
          console.warn('[order-cancel-refund-creditnote.spec] invoice deleteMany failed:', err)
        }
        // … then the 2099 counters this run minted …
        if (issuedYear !== null && issuedMonth !== null && issuedSeries.length > 0) {
          try {
            await prisma.invoiceCounter.deleteMany({
              where: { series: { in: issuedSeries }, year: issuedYear, month: issuedMonth },
            })
          } catch (err) {
            console.warn('[order-cancel-refund-creditnote.spec] counter deleteMany failed:', err)
          }
        }
        // … then the order/number/PI/fixture (idempotent, allowSold releases
        // the retained number — fine, the fixture is deleted right after).
        await teardownBoughtOrder(bought)
      }
    }
  })
})
