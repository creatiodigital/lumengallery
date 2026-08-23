/**
 * AR-131 — Invoice "Send invoice" button UI spec.
 *
 * This spec drives the REAL admin "Send invoice" button on the order-detail
 * page — which means `sendInvoice` (including PDF rendering via
 * @react-pdf/renderer and number minting) runs on the Next.js server during
 * the test. It is therefore subject to the absolute no-emails-in-e2e rule
 * ([[feedback_no_emails_in_e2e]]):
 *
 *   NEVER run this spec against a live `pnpm dev` server — that would email
 *   the buyer for real. Always use the normal e2e path:
 *     1. Stop any running `pnpm dev` process.
 *     2. `pnpm e2e:server` (spawned by playwright.config) injects SKIP_EMAILS
 *        into the server environment so no Resend traffic leaves the suite.
 *   The in-process runner also needs SKIP_EMAILS on the RUNNER side if you call
 *   helpers that go through the server action path directly.
 *
 * TEARDOWN ORDER (mandatory — Invoice.orderId FK is onDelete: Restrict):
 *   1. prisma.invoice.deleteMany — removes the invoice row first.
 *   2. teardownBoughtOrder     — voids the PI, releases the edition number,
 *                                deletes the order. FK satisfied.
 *
 * The InvoiceCounter row for the current month is intentionally NOT deleted
 * (numbers only ever move forward; leaving the counter is safe and avoids
 * collisions with manual-test runs in the same month).
 */
import { test, expect } from '@playwright/test'
import { r2Reachable, R2_BLOCKED_REASON } from './r2-reachable'

import prisma from '@/lib/prisma'

import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'
import { seedCookieConsent } from './consent-helpers'

test.describe('Invoice — send button UI', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('clicking Send invoice mints a number on the order and shows it in the register', async ({
    page,
  }) => {
    test.skip(!(await r2Reachable()), R2_BLOCKED_REASON)
    test.setTimeout(180_000)

    let bought: BoughtLimitedOrder | null = null

    try {
      // ── 1. Create a throwaway limited-edition order. ──────────────────────
      // The "Send invoice" button is un-gated (no fulfillment stage required),
      // so we can issue the invoice immediately after buying without advancing
      // through Capture / Place / Started.
      bought = await buyOneLimited({ editionSize: 5, tag: 'invoice-ui' })

      // ── 2. Navigate to the order-detail admin page. ───────────────────────
      await seedCookieConsent(page)
      await page.goto(`/admin/orders/${bought.orderId}`)

      // ── 3. Click "Send invoice" → confirm in the ConfirmModal. ────────────
      // The button label is exactly "Send invoice" when no invoice exists yet.
      await page.getByRole('button', { name: /Send invoice/i }).click()

      // The ConfirmModal appears; confirm with "Yes, send invoice".
      await page.getByRole('button', { name: /Yes, send invoice/i }).click()

      // ── 4. Assert the invoice number appears on the order detail page. ────
      // After the server action completes and the component re-loads, the
      // invoice section switches to the "invoice exists" branch which renders
      // the number in a monospace <span> and a "See invoice" button.
      // The number format is AR-MM-YYYY-NNN.
      // The number appears in several places once the section reloads (the
      // invoice span + event-log rows/payloads) — assert the first match to
      // stay strict-mode safe.
      const numberLocator = page.getByText(/AR-\d{2}-\d{4}-\d{3}/)
      await expect(numberLocator.first()).toBeVisible({ timeout: 30_000 })

      // Capture the actual number text so we can assert it in the register.
      // We try the DOM first; fall back to the DB if textContent is mangled.
      let theNumber: string | null = await numberLocator.first().textContent()
      if (!theNumber || !/^AR-\d{2}-\d{4}-\d{3}$/.test(theNumber.trim())) {
        // Fallback: read the number straight from the DB — more reliable than
        // parsing DOM text that might contain surrounding whitespace.
        const invoiceRow = await prisma.invoice.findFirst({
          where: { orderId: bought.orderId, type: 'invoice' },
          select: { number: true },
        })
        theNumber = invoiceRow?.number ?? null
      } else {
        theNumber = theNumber.trim()
      }

      if (!theNumber) {
        throw new Error('Could not determine invoice number from DOM or DB after sending.')
      }

      // ── 5. Assert the "See invoice" button is present on the order. ───────
      // The button uses a `label` prop so Playwright finds it by accessible name.
      await expect(page.getByRole('link', { name: /See invoice/i })).toBeVisible({
        timeout: 10_000,
      })

      // ── 6. Navigate to /admin/invoices and assert the number is visible. ──
      // The register's initial load uses no year/month filter (yearFilter starts
      // as `undefined`), so listInvoices({}) returns ALL invoices — the freshly
      // minted row is in the first-page results without needing to set a filter.
      await page.goto('/admin/invoices')

      await expect(page.getByText(theNumber)).toBeVisible({ timeout: 30_000 })

      // ── 7. ORDER IS KING (dev/staging): deleting the order takes its
      // invoice with it. Drive the real Danger-zone delete on an INVOICED
      // order — in production this exact click is refused ("issue a credit
      // note instead"), but e2e always runs with a non-production
      // NEXT_PUBLIC_APP_ENV, so deleteOrder cascades: invoice rows + PDFs
      // deleted, ledger number freed, order gone. Doubles as this spec's
      // teardown — the finally-block becomes a no-op backstop.
      await page.goto(`/admin/orders/${bought.orderId}`)
      await page.getByRole('button', { name: 'Delete order' }).click()
      await page.getByRole('button', { name: 'Yes, delete permanently' }).click()

      // Order gone…
      await expect
        .poll(async () => prisma.printOrder.count({ where: { id: bought!.orderId } }), {
          message: 'invoiced order deleted by the Danger zone (dev cascade)',
          timeout: 15_000,
        })
        .toBe(0)
      // …its invoice cascaded with it…
      expect(
        await prisma.invoice.count({ where: { orderId: bought!.orderId } }),
        'invoice rows go with their order — ORDER is king',
      ).toBe(0)
      // …and its ledger entry is back in the pool.
      const freed = await prisma.editionNumber.findFirst({
        where: { variantId: bought.fixture.variantId, number: bought.number },
        select: { state: true, paymentIntentId: true, orderId: true },
      })
      expect(freed?.state, 'ledger number freed with the order').toBe('available')
      expect(freed?.paymentIntentId, 'freed number drops its PI').toBeNull()

      // The register no longer shows the number.
      await page.goto('/admin/invoices')
      await expect(page.getByText(theNumber)).toHaveCount(0, { timeout: 30_000 })
    } finally {
      // ── Teardown (always runs — no Playwright order left on the dashboard). ─
      if (bought) {
        // Step 1: delete invoice rows first (FK onDelete: Restrict on orderId).
        try {
          await prisma.invoice.deleteMany({ where: { orderId: bought.orderId } })
        } catch (err) {
          console.warn('[invoice-ui.spec] invoice deleteMany failed:', err)
        }

        // Step 2: release edition number, void PI, delete order.
        await teardownBoughtOrder(bought)
      }
    }
  })
})
