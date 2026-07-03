import { test, expect } from '@playwright/test'

import {
  createCartPaymentIntent,
  type CartCheckoutItem,
} from '@/components/checkout/CartCheckout/createCartPaymentIntent'
import { createPrintOrderFromCart } from '@/lib/orders/createPrintOrderFromCart'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

import { deletePrintOrderByPaymentIntent } from './cleanup-helpers'
import { editionNumberStates, setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { buyExistingLimited, type BoughtCopy } from './order-helpers'
import { cancelPaymentIntent, fixtureAddress } from './stripe-helpers'

/**
 * CONCURRENT full-money-path checkouts against ONE limited variant.
 *
 * limited-editions.spec.ts proves two parallel RESERVATIONS get distinct
 * numbers, but stops at the reservation layer. This spec runs the whole
 * money path in parallel — createCartPaymentIntent (reserve + Stripe PI) →
 * Stripe auth → createPrintOrderFromCart — because that is what two real
 * buyers clicking "Pay" at the same moment execute, and it is where a race
 * would turn into a real double-sold print. The staging QA scenario this
 * de-risks: "2 users buying the same limited series — series number correct,
 * no duplications."
 *
 * Concurrency is real: the promises interleave their Prisma/Stripe awaits on
 * one event loop, so the DB sees overlapping transactions and the atomic
 * claim (`FOR UPDATE SKIP LOCKED` + `@@unique([variantId, number])`) is
 * genuinely exercised. In-process money path → SKIP_EMAILS guard applies
 * ([[feedback_no_emails_in_e2e]]); throwaway fixture; full teardown.
 */

// Local unique cart-line id (mirrors order-helpers' internal counter).
let lineSeq = 0
const nextLineId = () => `e2e-conc-line-${(lineSeq += 1)}`

type TryBuyResult =
  | { ok: true; paymentIntentId: string; orderId: string; number: number }
  | { ok: false; error: string }

/**
 * Failure-tolerant single-copy buy, for probing the sold-out boundary where
 * exactly one of the concurrent buyers is EXPECTED to lose. (order-helpers'
 * buyExistingLimited asserts success internally, so it can't model the loser.)
 */
async function tryBuyOne(
  fixture: { slug: string; variantId: string },
  opts: { tag: string; email: string },
): Promise<TryBuyResult> {
  // Same hard stop as order-helpers.placeCartOrder: this path calls the
  // buyer/admin email senders in THIS process — refuse rather than send.
  if (process.env.SKIP_EMAILS !== 'true' && process.env.E2E_SEND_EMAILS !== 'true') {
    throw new Error(
      'Refusing to place an order: SKIP_EMAILS is not "true" in this process (see order-helpers.ts).',
    )
  }

  const line: CartCheckoutItem = {
    lineId: nextLineId(),
    artworkSlug: fixture.slug,
    providerId: 'printspace',
    config: { values: {} },
    variantId: fixture.variantId,
    editionType: 'limited',
    quantity: 1,
    editionNumberIds: [],
  }
  const address = fixtureAddress(opts.tag, { email: opts.email })

  const intent = await createCartPaymentIntent({ items: [line], address })
  if (!intent.ok) return { ok: false, error: intent.error }

  await stripe.paymentIntents.confirm(intent.paymentIntentId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://example.com/e2e-return',
  })
  const created = await createPrintOrderFromCart(
    await stripe.paymentIntents.retrieve(intent.paymentIntentId),
  )
  if (!created.ok) return { ok: false, error: created.error }

  const bound = await prisma.editionNumber.findFirst({
    where: { paymentIntentId: intent.paymentIntentId },
    select: { number: true },
  })
  return {
    ok: true,
    paymentIntentId: intent.paymentIntentId,
    orderId: created.orderId,
    number: bound?.number ?? -1,
  }
}

test.describe('Concurrent limited-edition checkouts (full money path)', () => {
  test('three buyers checking out simultaneously get three distinct numbers — no duplicates, no oversell', async () => {
    test.setTimeout(180_000)

    const fixture = await setupLimitedFixture(3)
    const placed: BoughtCopy[] = []
    try {
      // Fire all three FULL checkouts at once. allSettled so one failure
      // doesn't orphan the other in-flight buys before teardown.
      const settled = await Promise.allSettled([
        buyExistingLimited(fixture, { tag: 'conc-A', email: 'e2e+conc-a@example.com' }),
        buyExistingLimited(fixture, { tag: 'conc-B', email: 'e2e+conc-b@example.com' }),
        buyExistingLimited(fixture, { tag: 'conc-C', email: 'e2e+conc-c@example.com' }),
      ])
      for (const s of settled) if (s.status === 'fulfilled') placed.push(s.value)

      const failures = settled.filter((s) => s.status === 'rejected')
      expect(
        failures,
        `all three concurrent buys should succeed on a size-3 edition: ${failures
          .map((f) => String((f as PromiseRejectedResult).reason))
          .join(' | ')}`,
      ).toHaveLength(0)

      // Distinct numbers, and exactly the set {1,2,3} — SKIP LOCKED hands each
      // buyer the lowest row not locked by a sibling, never the same row twice.
      const numbers = placed.map((p) => p.number).sort()
      expect(numbers, 'the three buyers hold exactly numbers 1, 2, 3').toEqual([1, 2, 3])

      // Three distinct orders, one per buyer.
      const orderIds = new Set(placed.map((p) => p.orderId))
      expect(orderIds.size, 'each buyer gets their own order').toBe(3)

      // Ledger ground truth: all 3 slots taken, each by a different PI —
      // i.e. no slot double-assigned and none left dangling.
      const ledger = await editionNumberStates(fixture.variantId)
      const taken = ledger.filter((s) => s.state !== 'available')
      expect(taken, 'every slot of the size-3 edition is taken').toHaveLength(3)
      const pis = new Set(taken.map((s) => s.paymentIntentId))
      expect(pis.size, 'every taken slot belongs to a different PaymentIntent').toBe(3)
    } finally {
      for (const p of placed) {
        await cancelPaymentIntent(p.paymentIntentId)
        await deletePrintOrderByPaymentIntent(p.paymentIntentId)
      }
      await teardownLimitedFixture(fixture)
    }
  })

  test('when ONE copy remains, exactly one of two simultaneous checkouts wins; the loser fails cleanly and leaves no residue', async () => {
    test.setTimeout(180_000)

    const fixture = await setupLimitedFixture(1)
    const winners: TryBuyResult[] = []
    try {
      const settled = await Promise.allSettled([
        tryBuyOne(fixture, { tag: 'boundary-A', email: 'e2e+boundary-a@example.com' }),
        tryBuyOne(fixture, { tag: 'boundary-B', email: 'e2e+boundary-b@example.com' }),
      ])

      // tryBuyOne never rejects on the sold-out path — a rejection is a bug.
      const rejected = settled.filter((s) => s.status === 'rejected')
      expect(
        rejected,
        `tryBuyOne should resolve (ok or sold-out), not throw: ${rejected
          .map((f) => String((f as PromiseRejectedResult).reason))
          .join(' | ')}`,
      ).toHaveLength(0)

      const results = settled.map((s) => (s as PromiseFulfilledResult<TryBuyResult>).value)
      const ok = results.filter((r) => r.ok)
      const lost = results.filter((r) => !r.ok)
      winners.push(...ok)

      // The boundary invariant: 1 winner, 1 clean loser — never 0 or 2.
      expect(ok, 'exactly one buyer wins the last copy').toHaveLength(1)
      expect(lost, 'exactly one buyer loses').toHaveLength(1)
      expect(
        (lost[0] as { ok: false; error: string }).error,
        'the loser is told the edition sold out (not an opaque failure)',
      ).toMatch(/sold out|no longer available|expired/i)

      const winner = ok[0] as Extract<TryBuyResult, { ok: true }>
      expect(winner.number, 'the winner holds copy 1/1').toBe(1)

      // Ledger ground truth: the single slot belongs to the winner's PI, and
      // the loser left no ghost state behind (no stray reservation/PI).
      const ledger = await editionNumberStates(fixture.variantId)
      expect(ledger, 'a size-1 edition has exactly one slot').toHaveLength(1)
      expect(ledger[0].state, 'the only slot is taken (not available)').not.toBe('available')
      expect(ledger[0].paymentIntentId, "the slot carries the WINNER's PI").toBe(
        winner.paymentIntentId,
      )

      // Exactly one order exists across both attempts.
      const orders = await prisma.printOrder.count({
        where: { paymentIntentId: { in: results.filter((r) => r.ok).map((r) => (r as Extract<TryBuyResult, { ok: true }>).paymentIntentId) } },
      })
      expect(orders, 'one order total — the loser created nothing').toBe(1)
    } finally {
      for (const w of winners) {
        if (w.ok) {
          await cancelPaymentIntent(w.paymentIntentId)
          await deletePrintOrderByPaymentIntent(w.paymentIntentId)
        }
      }
      await teardownLimitedFixture(fixture)
    }
  })
})
