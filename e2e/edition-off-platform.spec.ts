import { expect, test } from '@playwright/test'

import prisma from '@/lib/prisma'

import { deletePrintOrderById } from './cleanup-helpers'
import {
  editionNumberStates,
  setupLimitedFixture,
  teardownLimitedFixture,
} from './edition-helpers'
import { buyExistingLimited, type BoughtCopy } from './order-helpers'
import { cancelPaymentIntent } from './stripe-helpers'

/**
 * Off-platform (gift) orders — gift / artist copy / test print:
 * the admin consumes a number by hand from the edition-sales ledger,
 * which creates an OffPlatformOrder (no Stripe, no PrintOrder) that
 * walks the manual TPS stages. The ledger stays authoritative:
 *   - the number flips to `sold`, badged with kind + recipient
 *   - a real buyer afterwards gets the NEXT number (never the consumed one)
 *   - the gift order advances pending → Placed → … → Shipped (tracking)
 *   - cancelling the gift order releases the number back to available
 */

test.use({ storageState: 'e2e/.auth/admin.json' })

const NOTE = `e2e off-platform copy ${Date.now().toString(36)}`
const RECIPIENT = `E2E Recipient ${Date.now().toString(36)}`

test('gift order: create, buyers skip its number, stages advance, cancel releases', async ({
  page,
}) => {
  const fixture = await setupLimitedFixture(3)
  let bought: BoughtCopy | null = null

  try {
    // ── Create an artist-copy gift order via the variant deep link ───
    // (The artwork panel's "Create gift order" button navigates here —
    // the modal opens preselected on the variant.)
    await page.goto(`/admin/edition-sales?gift=${fixture.variantId}`)
    await expect(page.getByText('Add an off-platform copy')).toBeVisible()
    // Variant preselected by the deep link; number defaults to lowest (1).
    await expect(page.getByRole('button', { name: /E2E Limited Edition/ })).toBeVisible()
    // Kind: custom dropdown — open it, pick Artist copy.
    await page.getByRole('button', { name: /Gallery gift/ }).click()
    await page.getByRole('option', { name: /Artist copy/ }).click()
    await page.fill('#gift-recipient', RECIPIENT)
    await page.fill('#gift-line1', 'Musterstraße 12')
    await page.fill('#gift-city', 'Berlin')
    await page.fill('#gift-postal', '10115')
    await page.fill('#gift-country', 'Germany')
    await page.fill('#gift-note', NOTE)
    await page.getByRole('button', { name: 'Mark number as taken' }).click()

    // Ledger row renders with the kind badge + note where a buyer would be.
    await expect(page.getByText(NOTE)).toBeVisible()
    const row = page.locator('tr', { hasText: NOTE })
    await expect(row.getByText('Artist copy')).toBeVisible()
    await expect(row.getByText(`1/${fixture.editionSize}`)).toBeVisible()

    // #1 is sold in the DB ledger.
    await expect
      .poll(async () => {
        const states = await editionNumberStates(fixture.variantId)
        return states.find((n) => n.number === 1)?.state
      })
      .toBe('sold')

    // The ledger's own Release refuses gift-bound rows (cancel instead).
    await row.getByRole('button', { name: 'Release' }).click()
    await page.getByRole('button', { name: 'Yes, release it' }).click()
    await expect(page.getByText(/gift \/ artist-copy order/i)).toBeVisible()
    await page.getByRole('button', { name: 'Keep it' }).click()

    // ── A real buyer gets #2 — the hand-consumed #1 is never sellable ─
    bought = await buyExistingLimited(fixture, { tag: 'off-platform-skip' })
    expect(bought.number).toBe(2)

    // ── Gift order walks the manual stages ───────────────────────────
    await page.goto('/admin/gift-orders')
    const giftRow = page.locator('tr', { hasText: RECIPIENT })
    await expect(giftRow.getByText('To place at TPS')).toBeVisible()

    await giftRow.getByRole('button', { name: 'Mark placed at TPS' }).click()
    await expect(giftRow.getByText('Placed', { exact: true })).toBeVisible()

    await giftRow.getByRole('button', { name: 'Production started' }).click()
    await expect(giftRow.getByText('In production')).toBeVisible()

    await giftRow.getByRole('button', { name: 'Mark shipped' }).click()
    await page.fill('input[placeholder^="https"]', 'https://tracking.example/e2e')
    await page.getByRole('button', { name: 'Mark shipped' }).last().click()
    await expect(giftRow.getByText('Shipped')).toBeVisible()
    await expect(giftRow.getByRole('link', { name: /tracking/ })).toBeVisible()

    // ── Cancel releases the number back to available ─────────────────
    await giftRow.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Yes, cancel it' }).click()
    await expect(giftRow.getByText('Cancelled')).toBeVisible()

    await expect
      .poll(async () => {
        const states = await editionNumberStates(fixture.variantId)
        return states.find((n) => n.number === 1)?.state
      })
      .toBe('available')
  } finally {
    if (bought) {
      await cancelPaymentIntent(bought.paymentIntentId).catch(() => {})
      await deletePrintOrderById(bought.orderId).catch(() => {})
    }
    // The cancelled gift-order row itself is a dashboard stray — remove it
    // (recipient name is unique per run).
    await prisma.offPlatformOrder
      .deleteMany({ where: { recipientName: RECIPIENT } })
      .catch(() => {})
    await teardownLimitedFixture(fixture)
  }
})
