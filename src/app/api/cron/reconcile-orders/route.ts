import crypto from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { findOrphanedReservations } from '@/lib/editions/findOrphanedReservations'
import {
  isDeadPaymentIntentStatus,
  settleDeadPaymentIntent,
} from '@/lib/orders/settleDeadPaymentIntent'
import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
import { ensureOrderForPaymentIntent } from '@/lib/orders/ensureOrderForPaymentIntent'
import { sendAdminCriticalAlert } from '@/lib/emails/adminCriticalAlert'
import {
  sendAuthorizationExpiryWarning,
  type ExpiringAuthorization,
} from '@/lib/emails/authorizationExpiryWarning'
import { authorizationHold } from '@/lib/orders/authorizationPolicy'
import { formatOrderRef } from '@/lib/orders/orderRef'
import { captureError } from '@/lib/observability/captureError'
import { cleanupExpiredRateLimits } from '@/lib/rateLimit'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_MIN_AGE_MINUTES = 30

/**
 * Safety-net cron (Layer 3 of guaranteed order capture). Four phases:
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
 *   C. SETTLE — find orders stuck at `authorized` whose PaymentIntent Stripe
 *      reports as canceled. Phase B only sees reservations NEVER bound to an
 *      order, so once a number is bound its only release path was the
 *      `payment_intent.canceled` webhook; wherever that is missing, the order
 *      freezes forever holding an unsellable copy. Deliberately NOT time-boxed
 *      to the 24h listing — a hold that died while the webhook was down can be
 *      arbitrarily old, and those are the ones nothing else will find.
 *
 *   D. WARN — the preventive half. A, B and C are all cleanup, running after a
 *      hold is already dead and the sale already lost. This one names the
 *      orders whose authorization is close to lapsing while capturing them is
 *      still possible, in one daily email. Runs last, so phase C has already
 *      removed the genuinely dead ones.
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

  // Phase C — settle orders whose authorization died.
  //
  // The gap this closes: phase B only looks at reservations NOT bound to an
  // order (`orderId: null, orderItemId: null`). Once a number is bound, its
  // only release path was the `payment_intent.canceled` webhook — so whenever
  // that webhook is missing, an expired hold leaves the order stuck at
  // `authorized` forever, still offering a Capture button that can only fail,
  // with its edition number out of stock permanently.
  //
  // That is not hypothetical: the sandbox had no webhook endpoint registered
  // for two months, and four orders from June and July were found in exactly
  // this state, holding four copies that could never be sold.
  //
  // Deliberately NOT time-boxed to the 24h PI listing above: a hold that died
  // while the webhook was down may be arbitrarily old, and those are precisely
  // the ones nothing else will ever find.
  const stuckOrders = await prisma.printOrder.findMany({
    where: {
      paymentStatus: 'authorized',
      createdAt: { lt: new Date(Date.now() - minAgeMinutes * 60 * 1000) },
    },
    select: { id: true, paymentIntentId: true },
  })

  let deadAuthsSettled = 0
  let deadAuthNumbersReleased = 0
  let deadAuthUnresolved = 0
  const deadAuthLines: string[] = []

  for (const order of stuckOrders) {
    const piId = order.paymentIntentId
    const pi = await stripe.paymentIntents.retrieve(piId).catch(() => null)
    if (!pi) {
      // Same rule as phase B: never act on incomplete information. Flag it.
      deadAuthUnresolved += 1
      deadAuthLines.push(`${piId} — PI could not be retrieved from Stripe`)
      continue
    }
    if (!isDeadPaymentIntentStatus(pi.status)) continue
    const settled = await settleDeadPaymentIntent(piId, 'cron')
    if (settled.orderCanceled || settled.numbersReleased > 0) {
      deadAuthsSettled += 1
      deadAuthNumbersReleased += settled.numbersReleased
      deadAuthLines.push(`${piId} — order canceled, ${settled.numbersReleased} number(s) released`)
    }
  }

  // Phase D — warn about holds that are STILL ALIVE but running out.
  //
  // Phases B and C are both cleanup: they run after a hold has already died,
  // and by then the sale is gone and the copy has spent days out of stock. This
  // is the preventive half. An authorization lapses on Stripe's schedule with
  // no event we act on until it is too late, so once a day we say which orders
  // are close, while capturing them is still possible.
  //
  // Runs LAST on purpose: phase C has just settled the genuinely dead ones, so
  // whatever is still 'authorized' here has a live PaymentIntent and a real
  // decision attached to it.
  //
  // The cron is daily (vercel.json: "0 9 * * *"), so "once a day" needs no
  // dedupe state — one tick is one email. There is no all-clear email: a daily
  // "nothing to do" trains the reader to delete the one that matters unread.
  const ageingOrders = await prisma.printOrder.findMany({
    where: { paymentStatus: 'authorized', fulfillmentStatus: null },
    select: {
      id: true,
      createdAt: true,
      paymentStatus: true,
      buyerName: true,
      totalCents: true,
      currency: true,
    },
  })

  const expiring: ExpiringAuthorization[] = []
  for (const o of ageingOrders) {
    const hold = authorizationHold(o)
    if (!hold || hold.status === 'fresh') continue
    expiring.push({
      orderRef: formatOrderRef(o.id),
      buyerName: o.buyerName,
      totalCents: o.totalCents,
      currency: o.currency,
      days: hold.days,
      daysLeft: hold.daysLeft,
      lapsed: hold.status === 'expired',
    })
  }

  if (expiring.length > 0) {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theartroom.gallery'
    // Never let a failed reminder take down the cron — phases A to C repair
    // real data and must not be undone by a Resend blip.
    try {
      await sendAuthorizationExpiryWarning({
        orders: expiring,
        ordersUrl: `${base}/admin/orders`,
      })
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)), {
        flow: 'cron',
        stage: 'reconcile-orders-expiry-warning',
        level: 'warning',
        fingerprint: ['cron:expiry-warning-failed'],
      })
    }
  }

  // Always alert when anything was auto-fixed or still needs a human: an
  // auto-recovery or an auto-release happening at all means the webhook path is
  // degraded (Eduardo, 2026-06-24).
  const needsAlert =
    recovered > 0 ||
    recoveryFailed > 0 ||
    reservationsReleased > 0 ||
    reservationsUnresolvedPI > 0 ||
    deadAuthsSettled > 0 ||
    deadAuthUnresolved > 0
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
    if (deadAuthsSettled > 0) {
      parts.push(
        `${deadAuthsSettled} order${deadAuthsSettled === 1 ? '' : 's'} had an EXPIRED AUTHORIZATION (Stripe canceled the hold; the webhook never told us). They have been canceled and ${deadAuthNumbersReleased} edition number${deadAuthNumbersReleased === 1 ? '' : 's'} returned to the pool. The buyer was never charged and must be asked to re-order:\n\n${deadAuthLines.join('\n')}`,
      )
    }
    if (deadAuthUnresolved > 0) {
      parts.push(
        `${deadAuthUnresolved} order${deadAuthUnresolved === 1 ? '' : 's'} sitting at 'authorized' could not be checked against Stripe — left untouched, needs a manual look.`,
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
        deadAuthsSettled,
        deadAuthNumbersReleased,
        deadAuthUnresolved,
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
    stuckOrdersScanned: stuckOrders.length,
    deadAuthsSettled,
    deadAuthNumbersReleased,
    deadAuthUnresolved,
    authorizationsExpiring: expiring.length,
    authorizationsLapsed: expiring.filter((o) => o.lapsed).length,
  })
}
