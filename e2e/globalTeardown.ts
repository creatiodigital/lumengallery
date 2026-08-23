import type { FullConfig } from '@playwright/test'

import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'
import { restoreWebhookEndpoints } from './webhook-guard'

/**
 * Safety-net cleanup after the WHOLE e2e run. Per-spec `finally{}` teardown is
 * the first line of defence, but it does NOT run when a test TIMES OUT or the
 * worker is killed — exactly when a failing test would otherwise strand a
 * Playwright-created order on the live admin dashboard ([[feedback_e2e_no_dashboard_noise]]).
 * This guarantees zero Playwright noise regardless of how any test ended.
 *
 * SURGICAL by design — local dev and staging SHARE this database, and Eduardo is
 * manually testing REAL orders on it. We delete ONLY data tagged as ours:
 *   - throwaway fixtures (Artwork slug `e2e-limited-*` / `e2e-open-*`), and any
 *     order/item referencing them (FK-safe: orders first, then the artwork
 *     cascades its variant + edition numbers), and
 *   - any PrintOrder placed under the e2e buyer email.
 * It NEVER does a blanket order wipe (that's `scripts/reset-test-orders.ts`,
 * which is manual + opt-in).
 *
 * It also CANCELS the matching Stripe test PaymentIntents (collected before the
 * DB rows are deleted), so a timed-out run leaves no dangling card authorization
 * in the sandbox. Stripe has no delete-PI API, so the canceled PI RECORDS still
 * show in the test dashboard — clear those with Stripe's "delete all test data".
 *
 * Refuses to run against production. Best-effort: logs what it removed and
 * never throws (a teardown error must not fail an otherwise-green run).
 */
const E2E_BUYER_EMAIL = 'e2e+stripe@example.com'
const E2E_SLUG_PREFIXES = ['e2e-limited-', 'e2e-open-']

async function globalTeardown(_config: FullConfig): Promise<void> {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    console.warn('[globalTeardown] NEXT_PUBLIC_APP_ENV=production — skipping cleanup.')
    return
  }

  // Opt-out: keep every e2e order/fixture + leave its Stripe PI in its real state
  // so the run's results can be inspected and cross-checked against the Stripe
  // dashboard. Delete from /admin/orders by hand when done. (Eduardo, 2026-06-26.)
  if (process.env.E2E_KEEP_DATA === '1') {
    console.log(
      '[globalTeardown] E2E_KEEP_DATA=1 — keeping all e2e data + Stripe PIs for manual ' +
        'inspection. Nothing was removed; delete orders one by one from /admin/orders when done.',
    )
    return
  }

  try {
    const fixtures = await prisma.artwork.findMany({
      where: { OR: E2E_SLUG_PREFIXES.map((p) => ({ slug: { startsWith: p } })) },
      select: { id: true },
    })
    const fixtureIds = fixtures.map((f) => f.id)

    // 1) Collect every e2e PaymentIntent id BEFORE deleting the DB rows that
    //    carry it: from e2e orders (by buyer email + by fixture) and from any
    //    edition number still reserved against a PI (orphaned by a timeout).
    const variants = fixtureIds.length
      ? await prisma.limitedVariant.findMany({
          where: { artworkId: { in: fixtureIds } },
          select: { id: true },
        })
      : []
    const variantIds = variants.map((v) => v.id)

    const [ordersByEmail, ordersByFixture, reservedNumbers] = await Promise.all([
      prisma.printOrder.findMany({
        where: { buyerEmail: E2E_BUYER_EMAIL },
        select: { paymentIntentId: true },
      }),
      fixtureIds.length
        ? prisma.printOrder.findMany({
            where: { artworkId: { in: fixtureIds } },
            select: { paymentIntentId: true },
          })
        : Promise.resolve([]),
      variantIds.length
        ? prisma.editionNumber.findMany({
            where: { variantId: { in: variantIds }, paymentIntentId: { not: null } },
            select: { paymentIntentId: true },
          })
        : Promise.resolve([]),
    ])

    const piIds = new Set<string>()
    for (const row of [...ordersByEmail, ...ordersByFixture, ...reservedNumbers]) {
      if (row.paymentIntentId) piIds.add(row.paymentIntentId)
    }

    // 2) Cancel each in Stripe, tagged so the test dashboard shows WHY. Stripe's
    //    cancel takes only an enum reason, so the human-readable note goes in
    //    metadata (best-effort update, then cancel). Already-canceled / captured
    //    PIs throw — swallow and move on.
    let canceled = 0
    for (const pi of piIds) {
      try {
        await stripe.paymentIntents.update(pi, {
          metadata: { e2e: 'true', canceledBy: 'E2E test (globalTeardown)' },
        })
      } catch {
        // metadata update is non-essential — proceed to cancel regardless
      }
      try {
        await stripe.paymentIntents.cancel(pi, { cancellation_reason: 'abandoned' })
        canceled += 1
      } catch {
        // already canceled / captured / not cancelable — fine
      }
    }

    // 3) Now delete the DB rows. Orders by e2e buyer email first (catches
    //    distinct-buyer-email tests and orders whose fixture is already gone);
    //    cascades items + events.
    const byEmail = await prisma.printOrder.deleteMany({ where: { buyerEmail: E2E_BUYER_EMAIL } })

    // 4) Throwaway fixtures + anything still pinning them. Delete orders
    //    referencing the fixture FIRST (PrintOrder/PrintOrderItem → Artwork is
    //    onDelete:Restrict, so the artwork delete would block otherwise); the
    //    artwork delete then cascades its variant + edition numbers.
    let pinnedOrders = 0
    for (const id of fixtureIds) {
      const r = await prisma.printOrder.deleteMany({ where: { artworkId: id } })
      pinnedOrders += r.count
      await prisma.artwork.deleteMany({ where: { id } })
    }

    if (byEmail.count || fixtures.length || pinnedOrders || canceled) {
      console.log(
        `[globalTeardown] swept e2e data — stripe PIs canceled=${canceled}, ` +
          `orders(by email)=${byEmail.count}, fixtures=${fixtures.length}, ` +
          `orders(pinning fixtures)=${pinnedOrders}`,
      )
    }
  } catch (err) {
    console.warn(
      '[globalTeardown] cleanup hit an error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
  } finally {
    // Put staging's webhook back on, whatever happened above. Also re-run at the
    // START of the next suite, because a killed process never reaches here.
    await restoreWebhookEndpoints().catch((err) =>
      console.warn(
        '[globalTeardown] could not restore webhooks:',
        err instanceof Error ? err.message : err,
      ),
    )
    await prisma.$disconnect().catch(() => {})
  }
}

export default globalTeardown
