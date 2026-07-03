import { test, expect, type Page } from '@playwright/test'

import prisma from '@/lib/prisma'

import { deletePrintOrderById } from './cleanup-helpers'
import { editionNumberStates, setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import {
  buyExistingLimited,
  buyLimitedPlusOpen,
  buyOneLimited,
  teardownBoughtMixed,
  teardownBoughtOrder,
  type BoughtCopy,
  type BoughtLimitedOrder,
  type BoughtMixedOrder,
} from './order-helpers'
import { cancelPaymentIntent } from './stripe-helpers'

type Ledger = Awaited<ReturnType<typeof editionNumberStates>>

/** True when a PrintOrder row still exists — what the admin orders list renders. */
const orderExists = async (orderId: string): Promise<boolean> =>
  (await prisma.printOrder.count({ where: { id: orderId } })) > 0

/** The assigned (non-`available`) series numbers, ascending — the ledger rows. */
const takenNumbers = (ledger: Ledger): number[] =>
  ledger
    .filter((s) => s.state !== 'available')
    .map((s) => s.number)
    .sort((a, b) => a - b)

const slotState = (ledger: Ledger, n: number): string | undefined =>
  ledger.find((s) => s.number === n)?.state

/**
 * The buyer a series number currently belongs to, resolved through the full
 * chain the gallery cares about: ledger number → its PaymentIntent → the
 * PrintOrder's buyerEmail. `null` when the number is free (no PI bound, or no
 * surviving order) — i.e. it has dropped off the ledger.
 */
const buyerOfNumber = async (variantId: string, n: number): Promise<string | null> => {
  const en = await prisma.editionNumber.findFirst({
    where: { variantId, number: n },
    select: { paymentIntentId: true },
  })
  if (!en?.paymentIntentId) return null
  const order = await prisma.printOrder.findUnique({
    where: { paymentIntentId: en.paymentIntentId },
    select: { buyerEmail: true },
  })
  return order?.buyerEmail ?? null
}

/** Delete an order through the real admin Danger zone, then wait for it to be
 *  gone. Drives the auth-gated `deleteOrder` action (which releases the bound
 *  number) — never a raw DB delete, which would strand the slot as reserved. */
const deleteOrderViaAdmin = async (page: Page, orderId: string): Promise<void> => {
  await page.goto(`/admin/orders/${orderId}`)
  await page.getByRole('button', { name: 'Delete order' }).click()
  await page.getByRole('button', { name: 'Yes, delete permanently' }).click()
  await expect.poll(() => prisma.printOrder.count({ where: { id: orderId } })).toBe(0)
}

/**
 * Limited-edition ORDER lifecycle — the surfaces no other spec covers.
 *
 * limited-editions.spec.ts already proves the reservation LOGIC (lowest number,
 * no duplicates, sold-out, release) at the createPaymentIntent layer, and
 * stripe-payment.spec.ts proves the card FORM authorizes. Neither creates an
 * actual PrintOrder or inspects its contents. This spec picks up there: it buys
 * through the real cart money-path and asserts the order, the bound ledger
 * number, and the recorded detail. Cancel / delete / refund / capture build on
 * the same buyOneLimited() helper and land in follow-up tests.
 *
 * Headless by design (buyOneLimited authorizes the PI via the Stripe API), so
 * no wizard, no WebGL, no PaymentElement. Needs Stripe test-mode keys +
 * the synced DB.
 */
test.describe('Limited order lifecycle', () => {
  // The delete test drives the real admin UI (deleteOrder is auth-gated), so
  // reuse the admin session globalSetup saved. Harmless to the pure server-side
  // tests above, which never open a page.
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('buying one limited print creates the order, assigns the lowest series number, and records correct detail', async () => {
    test.setTimeout(120_000)

    let bought: BoughtLimitedOrder | null = null
    try {
      bought = await buyOneLimited({ editionSize: 30, tag: 'lifecycle-single-buy' })

      // (a) The order exists, tied to this PaymentIntent and buyer.
      const order = await prisma.printOrder.findUnique({
        where: { id: bought.orderId },
        include: { items: { include: { editionNumbers: true } } },
      })
      expect(order, 'a PrintOrder row should have been created').not.toBeNull()
      expect(order!.paymentIntentId).toBe(bought.paymentIntentId)
      expect(order!.buyerEmail).toBe(bought.address.email)

      // (b) Correct ledger series number: the LOWEST of a fresh edition (1/30),
      //     still 'reserved' (it only becomes 'sold' at capture), bound to this
      //     order. Exactly one number is taken — never two or three.
      expect(bought.number, 'a fresh edition assigns 1/30').toBe(1)
      const states = await editionNumberStates(bought.fixture.variantId)
      const taken = states.filter((s) => s.state !== 'available')
      expect(taken, 'exactly one number is taken').toHaveLength(1)
      expect(taken[0].number).toBe(1)
      expect(taken[0].state).toBe('reserved')

      // (c) Order detail: one line item, the right artwork at quantity 1, the
      //     bound 1/30, the buyer's phone stored verbatim (single field — no
      //     double prefix), and a total equal to the server-priced quote.
      expect(order!.items, 'one line item').toHaveLength(1)
      const item = order!.items[0]
      expect(item.artworkId).toBe(bought.fixture.artworkId)
      expect(item.quantity).toBe(1)
      expect(item.editionNumbers, 'the number is bound to its line item').toHaveLength(1)
      expect(item.editionNumbers[0].number).toBe(1)

      const shipping = order!.shippingAddress as { phone?: string; fullName?: string }
      expect(shipping.phone).toBe(bought.address.phone)
      expect(shipping.phone ?? '', 'no double dial-code prefix').not.toContain('+34 +34')

      expect(order!.totalCents, 'total = server-priced quote, never hardcoded').toBe(
        bought.totalCents,
      )
    } finally {
      await teardownBoughtOrder(bought)
    }
  })

  test('a limited + open cart makes one order with both items and one edition number (1); deleting it clears the order and the ledger row', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    let bought: BoughtMixedOrder | null = null
    try {
      bought = await buyLimitedPlusOpen({ editionSize: 30, tag: 'lifecycle-mixed' })

      // One order holds BOTH items, tied to this buyer + the server-priced total.
      const order = await prisma.printOrder.findUnique({
        where: { id: bought.orderId },
        include: { items: { include: { editionNumbers: true } } },
      })
      expect(order, 'one order created').not.toBeNull()
      expect(order!.items, 'two line items — limited + open').toHaveLength(2)
      expect(order!.buyerEmail).toBe(bought.address.email)
      expect(order!.totalCents).toBe(bought.totalCents)

      // Exactly one limited line (carries the number) + one open line (none).
      const withNumber = order!.items.filter((i) => i.editionNumbers.length > 0)
      const withoutNumber = order!.items.filter((i) => i.editionNumbers.length === 0)
      expect(withNumber, 'one limited line').toHaveLength(1)
      expect(withoutNumber, 'one open line').toHaveLength(1)
      expect(withNumber[0].artworkId).toBe(bought.limited.artworkId)
      expect(withoutNumber[0].artworkId).toBe(bought.open.artworkId)

      // Exactly ONE edition number, the lowest (1/30), reserved + bound.
      expect(bought.number, 'fresh edition assigns 1/30').toBe(1)
      const taken = (await editionNumberStates(bought.limited.variantId)).filter(
        (s) => s.state !== 'available',
      )
      expect(taken, 'exactly one number taken (the limited line)').toHaveLength(1)
      expect(taken[0].number).toBe(1)
      expect(taken[0].state).toBe('reserved')
      expect(withNumber[0].editionNumbers[0].number).toBe(1)

      // Delete via the real admin Danger zone (carries the admin session).
      const orderId = bought.orderId
      await page.goto(`/admin/orders/${orderId}`)
      await page.getByRole('button', { name: 'Delete order' }).click()
      await page.getByRole('button', { name: 'Yes, delete permanently' }).click()

      // The order row is gone…
      await expect.poll(() => prisma.printOrder.count({ where: { id: orderId } })).toBe(0)

      // …and the ledger row with it: the number is released back to available.
      const after = await editionNumberStates(bought.limited.variantId)
      expect(
        after.filter((s) => s.state !== 'available'),
        'no reserved/sold numbers remain',
      ).toHaveLength(0)
      expect(after.filter((s) => s.state === 'available')).toHaveLength(bought.editionSize)
    } finally {
      await teardownBoughtMixed(bought)
    }
  })

  test('three buyers + deletes: numbers assign lowest-first, a delete frees the number, the next buy recycles it, and deleting everything clears the ledger', async ({
    page,
  }) => {
    test.setTimeout(180_000)

    // One shared limited variant, three distinct buyers hitting it in turn —
    // models /artworks/landscape-and-river-52416 bought by users A, B, C.
    // Throwaway fixture (no wizard, no WebGL): a fresh edition guarantees the
    // deterministic 1/30 → 2/30 progression and self-deletes afterwards.
    const fixture = await setupLimitedFixture(30)
    const A = 'e2e+user-a@example.com'
    const B = 'e2e+user-b@example.com'
    const C = 'e2e+user-c@example.com'

    // Every PI/order we open, so teardown can void the hold + delete the row
    // even if an assertion bails mid-flow.
    const placed: BoughtCopy[] = []

    try {
      // ── User A and User B each buy one copy ──────────────────────────────
      const userA = await buyExistingLimited(fixture, { tag: 'multi-A', email: A })
      placed.push(userA)
      const userB = await buyExistingLimited(fixture, { tag: 'multi-B', email: B })
      placed.push(userB)

      // Two orders on the dashboard; ledger shows 1/30 → A and 2/30 → B.
      expect(userA.number, 'A takes the lowest number, 1/30').toBe(1)
      expect(userB.number, 'B takes the next number, 2/30').toBe(2)
      expect(await orderExists(userA.orderId), "A's order exists").toBe(true)
      expect(await orderExists(userB.orderId), "B's order exists").toBe(true)

      let ledger = await editionNumberStates(fixture.variantId)
      expect(takenNumbers(ledger), 'exactly 1/30 and 2/30 are assigned').toEqual([1, 2])
      expect(await buyerOfNumber(fixture.variantId, 1), '1/30 → A').toBe(A)
      expect(await buyerOfNumber(fixture.variantId, 2), '2/30 → B').toBe(B)

      // ── Delete User A's order (real admin Danger zone) ───────────────────
      await deleteOrderViaAdmin(page, userA.orderId)

      // One order left (B). 2/30 stays B's; 1/30 is freed — back to available
      // with no buyer, i.e. it drops off the ledger.
      expect(await orderExists(userA.orderId), "A's order is gone").toBe(false)
      expect(await orderExists(userB.orderId), "B's order remains").toBe(true)

      ledger = await editionNumberStates(fixture.variantId)
      expect(takenNumbers(ledger), 'only 2/30 remains on the ledger').toEqual([2])
      expect(slotState(ledger, 1), '1/30 is free again').toBe('available')
      expect(await buyerOfNumber(fixture.variantId, 1), '1/30 belongs to no one').toBeNull()
      expect(await buyerOfNumber(fixture.variantId, 2), '2/30 still → B').toBe(B)

      // ── User C buys: the freed 1/30 is recycled, NOT a fresh 3/30 ────────
      const userC = await buyExistingLimited(fixture, { tag: 'multi-C', email: C })
      placed.push(userC)

      expect(userC.number, 'C recycles the freed lowest number — 1/30, not 3/30').toBe(1)
      expect(await orderExists(userB.orderId), "B's order still exists").toBe(true)
      expect(await orderExists(userC.orderId), "C's order exists").toBe(true)

      ledger = await editionNumberStates(fixture.variantId)
      expect(takenNumbers(ledger), 'two orders: 1/30 and 2/30 assigned').toEqual([1, 2])
      expect(await buyerOfNumber(fixture.variantId, 1), '1/30 → C').toBe(C)
      expect(await buyerOfNumber(fixture.variantId, 2), '2/30 → B').toBe(B)

      // ── Delete both remaining orders ─────────────────────────────────────
      await deleteOrderViaAdmin(page, userB.orderId)
      await deleteOrderViaAdmin(page, userC.orderId)

      // No orders on the dashboard; every slot back to available — empty ledger.
      expect(await orderExists(userB.orderId), "B's order is gone").toBe(false)
      expect(await orderExists(userC.orderId), "C's order is gone").toBe(false)

      ledger = await editionNumberStates(fixture.variantId)
      expect(takenNumbers(ledger), 'no numbers assigned').toEqual([])
      expect(
        ledger.filter((s) => s.state === 'available'),
        'all 30 slots are free',
      ).toHaveLength(fixture.editionSize)
    } finally {
      for (const copy of placed) {
        await cancelPaymentIntent(copy.paymentIntentId)
        await deletePrintOrderById(copy.orderId)
      }
      await teardownLimitedFixture(fixture)
    }
  })
})
