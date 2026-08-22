import crypto from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { findOrphanedReservations } from '@/lib/editions/findOrphanedReservations'
import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
import { ensureOrderForPaymentIntent } from '@/lib/orders/ensureOrderForPaymentIntent'
import { sendAdminCriticalAlert } from '@/lib/emails/adminCriticalAlert'
import { captureError } from '@/lib/observability/captureError'
import { cleanupExpiredRateLimits } from '@/lib/rateLimit'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_MIN_AGE_MINUTES = 30

/**
 * Safety-net cron (Layer 3 of guaranteed order capture). Two phases:
 *
 *   A. RECOVER — list Stripe PaymentIntents from the last 24h that originated
 *      from our checkout (wizardConfig metadata for single-print, kind='cart'
 *      for cart) and are authorized (`requires_capture`/`succeeded`). If one has
 *      no PrintOrder row, create it on the spot via the SAME idempotent builder
 *      the confirmation page uses (`ensureOrderForPaymentIntent`), binding the
 *      reserved edition number. Any recovery means the webhook path is degraded,
 *      so we ALWAYS alert when something was auto-fixed.
 *
 *   B. RELEASE — find limited-edition numbers stuck `reserved` with a PI attached
 *      but no order (the orphaned-reservation leak: reserved at PI creation, but
 *      the webhook that releases on cancel/expiry never fired). Run AFTER phase A
 *      so authorized PIs have had their numbers bound first. For each remaining
 *      stuck PI: release the number iff the PI is dead
 *      (`canceled`/`requires_payment_method`/`requires_confirmation`); leave
 *      authorized/in-flight ones; if the PI can't be retrieved at all, leave it
 *      and alert (never auto-release on incomplete info).
 *
 * Why this exists: order creation must not depend solely on the Stripe webhook
 * (mid-deploy, DNS blip, our app down). Layer 1 closes the gap at confirmation;
 * this catches anything the buyer never came back to confirm.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Anything else is
 * 401. An authorized caller may pass `?minAgeMinutes=N` to override the 30-min
 * min-age (e.g. an immediate reconcile, or e2e where the PI is seconds old);
 * production cron sends no param → 30-min default.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron/reconcile-orders] CRON_SECRET not configured.')
    return NextResponse.json({ error: 'Cron not configured.' }, { status: 500 })
  }
  // Constant-time compare — a plain !== leaks a timing oracle on the secret
  // (same class of issue as the Apr-2026 webhook-timing fix).
  const authHeader = req.headers.get('authorization') ?? ''
  const expectedHeader = `Bearer ${expected}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Housekeeping: prune lapsed rate-limit counter rows so the table stays small.
  // Best-effort (never throws) and independent of the order-reconciliation work.
  await cleanupExpiredRateLimits()

  // 24h lookback. Stripe retries failed webhooks for up to 3 days; a 24h window
  // catches any orphan within a cron tick of it stabilising.
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)

  // Skip PIs younger than this — webhook delivery has its own retry window, and
  // we don't want to act on a transient delay that resolves itself in minutes.
  // Auth-gated `?minAgeMinutes=` override (default 30) for immediate reconciles
  // and tests; clamped to a sane range.
  // NB: searchParams.get returns null when absent, and Number(null) === 0 (not
  // NaN) — so guard on null FIRST, else the default min-age would never apply and
  // the cron would act on PaymentIntents seconds old in production.
  const minAgeParam = new URL(req.url).searchParams.get('minAgeMinutes')
  const parsedMinAge = minAgeParam === null ? Number.NaN : Number(minAgeParam)
  const minAgeMinutes =
    Number.isFinite(parsedMinAge) && parsedMinAge >= 0 ? parsedMinAge : DEFAULT_MIN_AGE_MINUTES
  const cutoff = Math.floor(Date.now() / 1000) - minAgeMinutes * 60

  let stripePIs: Awaited<ReturnType<typeof stripe.paymentIntents.list>>['data'] = []
  try {
    // Single page is enough — 100 PIs in 24h is well above expected
    // launch volume. If that ever stops being true, paginate.
    const list = await stripe.paymentIntents.list({
      created: { gte: since },
      limit: 100,
    })
    stripePIs = list.data
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      flow: 'cron',
      stage: 'reconcile-orders-list-pis',
      level: 'error',
      fingerprint: ['cron:reconcile-list-pis-failed'],
    })
    return NextResponse.json(
      { error: 'Could not list PaymentIntents from Stripe.' },
      { status: 500 },
    )
  }

  // Only consider PIs that:
  //  - originated from our checkout (single-print carries `wizardConfig`; cart
  //    carries `kind='cart'` and NO wizardConfig — both must be covered)
  //  - are in a state where an order should exist
  //  - are at least minAgeMinutes old (let webhook retries finish first)
  const ourPIs = stripePIs.filter((pi) => {
    const ours = Boolean(pi.metadata?.wizardConfig) || pi.metadata?.kind === 'cart'
    if (!ours) return false
    if (pi.created > cutoff) return false
    return (
      pi.status === 'requires_capture' || pi.status === 'succeeded' || pi.status === 'processing'
    )
  })

  const piIds = ourPIs.map((p) => p.id)
  const existing = piIds.length
    ? await prisma.printOrder.findMany({
        where: { paymentIntentId: { in: piIds } },
        select: { paymentIntentId: true },
      })
    : []
  const existingIds = new Set(existing.map((o) => o.paymentIntentId))

  // Orphan candidates: ours, in scope, no order row yet.
  const orphans = ourPIs.filter((pi) => !existingIds.has(pi.id))

  // Phase A — auto-recover. `processing` PIs aren't yet authorized, so
  // ensureOrderForPaymentIntent returns ok:false for them BY DESIGN — count them
  // as "still pending" (a few minutes from authorizing), not a hard failure.
  let recovered = 0
  let recoveryFailed = 0
  let stillPending = 0
  const recoveredIds: string[] = []
  const failedLines: string[] = []

  for (const pi of orphans) {
    if (pi.status === 'processing') {
      stillPending += 1
      continue
    }
    const res = await ensureOrderForPaymentIntent(pi.id)
    if (res.ok) {
      recovered += 1
      recoveredIds.push(pi.id)
    } else {
      recoveryFailed += 1
      const total = pi.amount ? `${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}` : '?'
      failedLines.push(`${pi.id} — ${pi.status} — ${total} — ${res.error}`)
    }
  }

  // Phase B — release orphan reservations. Runs AFTER phase A, so any PI we just
  // recovered has its number bound (orderId set) and falls out of this query;
  // only genuinely unbound reservations remain.
  const reservationCutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000)
  const orphanReservations = await findOrphanedReservations(reservationCutoff)

  let reservationsReleased = 0
  let reservationsUnresolvedPI = 0
  const unresolvedLines: string[] = []

  for (const { paymentIntentId } of orphanReservations) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null)
    if (!pi) {
      // Can't confirm it's dead — never auto-release on incomplete info
      // (Eduardo, 2026-06-24). Leave the number held and flag for a human.
      reservationsUnresolvedPI += 1
      unresolvedLines.push(`${paymentIntentId} — PI could not be retrieved from Stripe`)
      continue
    }
    if (pi.status === 'canceled') {
      // Genuinely dead: return the number to the pool.
      await releaseEditionNumberForPaymentIntent(paymentIntentId)
      reservationsReleased += 1
    } else if (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation') {
      // These are LIVE, still-confirmable statuses — the buyer may be typing
      // card details right now (reservedAt dates from add-to-cart, not from
      // reaching checkout). Cancel the PI FIRST so a later confirm can't
      // succeed against a number we are about to free; release only when the
      // cancel actually lands.
      try {
        await stripe.paymentIntents.cancel(paymentIntentId, {
          cancellation_reason: 'abandoned',
        })
      } catch {
        // Cancel refused — the PI advanced (confirm/processing/succeeded)
        // between retrieve and cancel. The buyer is live: leave the hold and
        // flag for a human instead of double-selling the number.
        reservationsUnresolvedPI += 1
        unresolvedLines.push(
          `${paymentIntentId} — cancel refused (PI advanced mid-check); reservation left held`,
        )
        continue
      }
      await releaseEditionNumberForPaymentIntent(paymentIntentId)
      reservationsReleased += 1
    }
    // Authorized (requires_capture/succeeded) or in-flight (processing/
    // requires_action): leave the hold — phase A owns the authorized case and
    // we never free a number whose card is still held.
  }

  // Always alert when anything was auto-fixed or still needs a human: an
  // auto-recovery or an auto-release happening at all means the webhook path is
  // degraded (Eduardo, 2026-06-24).
  const needsAlert =
    recovered > 0 || recoveryFailed > 0 || reservationsReleased > 0 || reservationsUnresolvedPI > 0
  if (needsAlert) {
    const parts: string[] = []
    if (recovered > 0) {
      parts.push(
        `${recovered} order${recovered === 1 ? '' : 's'} were AUTO-RECOVERED — the buyer paid but the Stripe webhook never created the order. They now exist in /admin/orders, but the webhook path is degraded and needs investigating before launch.\n\nRecovered: ${recoveredIds.join(', ')}`,
      )
    }
    if (reservationsReleased > 0) {
      parts.push(
        `${reservationsReleased} orphaned edition-number reservation${reservationsReleased === 1 ? '' : 's'} (PI canceled/abandoned, never bound to an order) were AUTO-RELEASED back to the available pool.`,
      )
    }
    if (recoveryFailed > 0) {
      parts.push(
        `${recoveryFailed} authorized PaymentIntent${recoveryFailed === 1 ? '' : 's'} could NOT be recovered automatically — a human must create the order or refund the buyer:\n\n${failedLines.join('\n')}`,
      )
    }
    if (reservationsUnresolvedPI > 0) {
      parts.push(
        `${reservationsUnresolvedPI} stuck reservation${reservationsUnresolvedPI === 1 ? '' : 's'} could not be resolved (PI not retrievable from Stripe) — left held, needs a manual check:\n\n${unresolvedLines.join('\n')}`,
      )
    }
    await sendAdminCriticalAlert({
      title: `Reconcile cron: ${recovered} recovered, ${reservationsReleased} released, ${recoveryFailed + reservationsUnresolvedPI} need a human`,
      problem: parts.join('\n\n'),
      context: {
        recovered,
        recoveryFailed,
        stillPending,
        reservationsReleased,
        reservationsUnresolvedPI,
        checked: ourPIs.length,
      },
      whatToDo: [
        'Investigate WHY the webhook did not fire: check the Stripe Dashboard webhook endpoint, signing secret, and event subscription for this environment.',
        'For any order that could not be recovered: open the PaymentIntent in Stripe, grab its metadata + shipping address, and recreate the order — or refund the buyer and ask them to re-place.',
        'For any unresolved reservation: confirm the PI in Stripe; if dead, release the number from the edition-sales ledger; if live, recover its order.',
        'Recovered orders are real and ready to fulfill; verify each one in /admin/orders.',
      ],
    })
  }

  return NextResponse.json({
    checked: ourPIs.length,
    recovered,
    recoveryFailed,
    stillPending,
    reservationsScanned: orphanReservations.length,
    reservationsReleased,
    reservationsUnresolvedPI,
  })
}
