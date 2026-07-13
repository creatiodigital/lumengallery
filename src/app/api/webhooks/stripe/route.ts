import { NextRequest, NextResponse } from 'next/server'

import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
import { markEditionNumberSold } from '@/lib/editions/reserveEditionNumber'
import { sendAdminCriticalAlert } from '@/lib/emails/adminCriticalAlert'
import { createPrintOrderFromCart } from '@/lib/orders/createPrintOrderFromCart'
import { createPrintOrderFromPaymentIntent } from '@/lib/orders/createPrintOrderFromPaymentIntent'
import { logOrderEvent } from '@/lib/orders/logOrderEvent'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StripeEvent = ReturnType<typeof stripe.webhooks.constructEvent>

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured.')
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: StripeEvent
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.warn('[stripe-webhook] Signature verification failed:', err)
    // Could be a misconfigured endpoint (secret mismatch between Stripe
    // dashboard and our env), or someone probing. Capture as warning —
    // a legitimate misconfig after a redeploy would show up as a spike.
    captureError(err, {
      flow: 'webhook',
      stage: 'stripe-sig-verify',
      level: 'warning',
      fingerprint: ['webhook:stripe-sig-verify'],
    })
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as AccountLike)
        break
      // Auth succeeded — funds held, not captured. This is our signal to
      // create the local PrintOrder so the admin can place it at TPS by
      // hand. Capture happens later when the admin clicks "Capture &
      // mark placed" on the admin order detail page.
      case 'payment_intent.amount_capturable_updated':
        await handlePaymentIntentAuthorized(event.data.object as PaymentIntentLike)
        break
      // Fires AFTER the admin clicks Capture from the order detail
      // page. Just confirms the charge actually went through.
      case 'payment_intent.succeeded':
        await handlePaymentIntentCaptured(event.data.object as PaymentIntentLike)
        break
      case 'payment_intent.canceled': {
        const pi = event.data.object as PaymentIntentLike
        const order = await prisma.printOrder.findUnique({
          where: { paymentIntentId: pi.id },
          select: { id: true },
        })
        // Return any held limited-edition number to the pool. `canceled`
        // also fires when an auth hold expires (~7 days), so this covers
        // the expiry case. Idempotent + a no-op for open editions.
        await releaseEditionNumberForPaymentIntent(pi.id).catch((err) =>
          console.warn('[stripe-webhook] release edition number failed:', err),
        )
        // Cart PIs stage their lines in a PendingCart row that only gets
        // consumed + deleted when the order is built. A canceled PI never
        // completed, so the row is leftover — clean it up. No-op for
        // single-print PIs (no row) or if it was already consumed.
        await prisma.pendingCart.delete({ where: { paymentIntentId: pi.id } }).catch(() => {})
        // Never overwrite a terminal/captured state. Stripe does not
        // guarantee event ordering and can redeliver: a stale `canceled`
        // arriving after a successful capture must not flip a paid order
        // back to canceled. Mirrors the succeeded handler's guard.
        await prisma.printOrder
          .updateMany({
            where: {
              paymentIntentId: pi.id,
              paymentStatus: { notIn: ['succeeded', 'refunded'] },
            },
            data: { paymentStatus: 'canceled' },
          })
          .catch((err) => console.warn('[stripe-webhook] update paymentStatus failed:', err))
        if (order) {
          await logOrderEvent({
            orderId: order.id,
            kind: 'auth_canceled',
            actor: 'stripe',
            message: 'PaymentIntent canceled — auth released',
            payload: { paymentIntentId: pi.id },
          })
        }
        break
      }
      case 'payment_intent.processing':
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as PaymentIntentLike
        const order = await prisma.printOrder.findUnique({
          where: { paymentIntentId: pi.id },
          select: { id: true },
        })
        const failed = event.type === 'payment_intent.payment_failed'
        // A hard failure releases any held edition number; 'processing'
        // is transient so we leave the reservation in place.
        if (failed) {
          await releaseEditionNumberForPaymentIntent(pi.id).catch((err) =>
            console.warn('[stripe-webhook] release edition number failed:', err),
          )
          // Same as canceled: a hard failure means the buyer never
          // completed, so drop any leftover cart staging row. Guarded
          // no-op for single-print PIs or an already-consumed row.
          await prisma.pendingCart.delete({ where: { paymentIntentId: pi.id } }).catch(() => {})
        }
        // Never overwrite a terminal/captured state — a stale or out-of-order
        // `payment_failed`/`processing` event must not clobber an order that
        // has already advanced (buyer retried on a second card, admin
        // captured). Mirrors the succeeded handler's terminal-state guard.
        await prisma.printOrder
          .updateMany({
            where: {
              paymentIntentId: pi.id,
              paymentStatus: { notIn: ['succeeded', 'refunded', 'canceled'] },
            },
            data: { paymentStatus: failed ? 'failed' : 'processing' },
          })
          .catch((err) => console.warn('[stripe-webhook] update paymentStatus failed:', err))
        if (order) {
          await logOrderEvent({
            orderId: order.id,
            kind: failed ? 'payment_failed' : 'payment_processing',
            actor: 'stripe',
            message: failed ? 'PaymentIntent payment_failed' : 'PaymentIntent processing',
            payload: { paymentIntentId: pi.id },
          })
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    // Never return 5xx here — Stripe will retry indefinitely. Log and ack
    // so we can investigate manually. Business-level retry happens via
    // admin actions in /admin/orders.
    console.error(`[stripe-webhook] ${event.type} handler threw:`, err)
    // But DO surface to Sentry — a silently swallowed webhook handler is
    // how orders go missing. Include event.id for idempotent retries.
    captureError(err, {
      flow: 'webhook',
      stage: 'stripe-handler-threw',
      extra: { eventType: event.type, eventId: event.id },
      level: 'error',
      fingerprint: ['webhook:stripe-handler-threw', event.type],
    })
    // Email the admin too — anything that throws here past the inner
    // handlers' own alerts is unexpected, and on the order-creation event
    // type a thrown handler likely means the buyer is held with no row.
    await sendAdminCriticalAlert({
      title: 'Webhook handler threw an exception',
      problem: `The Stripe webhook for event type "${event.type}" threw an exception. ${err instanceof Error ? err.message : String(err)}`,
      context: { eventType: event.type, eventId: event.id },
      whatToDo: [
        'Check the server logs and Sentry for the stack trace.',
        'If this is the amount_capturable_updated event, an order may be missing — check the reconciliation alert.',
        'Look up the related PaymentIntent in Stripe to confirm card state.',
      ],
    })
  }

  return NextResponse.json({ received: true })
}

// Minimal shapes for the two Stripe objects we care about. Avoids pulling
// the full Stripe.* namespace (not cleanly reachable under CJS types).
type AccountLike = {
  id: string
  details_submitted?: boolean
  payouts_enabled?: boolean
}

type PaymentIntentLike = {
  id: string
  metadata?: Record<string, string>
  shipping?: {
    name?: string | null
    phone?: string | null
    address?: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
      country?: string | null
    } | null
  } | null
  receipt_email?: string | null
}

async function handleAccountUpdated(account: AccountLike) {
  const complete = Boolean(account.details_submitted && account.payouts_enabled)
  const res = await prisma.user.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeOnboardingComplete: complete },
  })
  if (res.count === 0) {
    console.warn(`[stripe-webhook] account.updated for unknown account ${account.id}`)
  }
}

async function handlePaymentIntentAuthorized(pi: PaymentIntentLike) {
  // Cart PIs carry metadata.kind === 'cart' (set in createCartPaymentIntent)
  // and stage their line items in a PendingCart row; single-print PIs carry
  // the order fields in metadata. Dispatch on that flag. The cart builder
  // only reads pi.id + pi.metadata, so the minimal PaymentIntentLike shape
  // satisfies it directly.
  const res =
    pi.metadata?.kind === 'cart'
      ? await createPrintOrderFromCart(pi)
      : await createPrintOrderFromPaymentIntent(pi)
  if (!res.ok) {
    console.error(
      `[stripe-webhook] amount_capturable_updated pi=${pi.id} → order creation failed: ${res.error}`,
    )
    // The order-creation function fires its own targeted alerts for the
    // known failure shapes. This is a belt-and-braces alert so any new
    // failure mode added in the future doesn't go silently — it's safe
    // to receive two alerts for the same incident.
    const builder =
      pi.metadata?.kind === 'cart'
        ? 'createPrintOrderFromCart'
        : 'createPrintOrderFromPaymentIntent'
    await sendAdminCriticalAlert({
      title: 'Order creation failed after card auth',
      problem: `${builder} returned not-ok: ${res.error}`,
      paymentIntentId: pi.id,
      whatToDo: [
        'You may have already received a more specific alert above — check.',
        'Open the PaymentIntent in Stripe to confirm whether the buyer’s card is held.',
        'If held with no order: cancel the PI to release the hold, then contact the buyer.',
      ],
    })
    return
  }
  await logOrderEvent({
    orderId: res.orderId,
    kind: 'auth_received',
    actor: 'stripe',
    message: 'Buyer card authorized',
    payload: { paymentIntentId: pi.id },
  })
  console.log(`[stripe-webhook] amount_capturable_updated pi=${pi.id} → order=${res.orderId}`)
}

async function handlePaymentIntentCaptured(pi: PaymentIntentLike) {
  const order = await prisma.printOrder.findUnique({
    where: { paymentIntentId: pi.id },
    select: { id: true, paymentStatus: true },
  })
  if (!order) {
    console.warn(`[stripe-webhook] payment_intent.succeeded pi=${pi.id} → no PrintOrder found`)
    // succeeded fires after capture, which only the admin can do via
    // markPlaced — so the order MUST exist by this point. If it doesn't,
    // something has gone very wrong (manual capture in Stripe Dashboard
    // bypassing our flow, or order deleted between auth and capture).
    await sendAdminCriticalAlert({
      title: 'Capture confirmed but no PrintOrder row',
      problem:
        'A PaymentIntent was captured (money moved from buyer to our balance) but no matching PrintOrder exists locally. The buyer has been charged.',
      paymentIntentId: pi.id,
      whatToDo: [
        'Open the PaymentIntent in Stripe to see the buyer details.',
        'Check whether someone manually captured the PI from the Stripe dashboard (bypassing the admin app).',
        'Check whether the order was deleted from /admin/orders after auth but before capture.',
        'Refund the buyer immediately, then contact them to re-place the order.',
      ],
    })
    return
  }
  // A capture event only ever advances authorized → succeeded. Stripe can
  // redeliver (or an admin can resend) this event long after the order was
  // refunded — flipping a terminal status back to 'succeeded' would re-arm
  // every fulfillment action and the artist-payout release, so terminal
  // states are never overwritten. Already-succeeded is an idempotent no-op.
  if (order.paymentStatus === 'refunded' || order.paymentStatus === 'canceled') {
    console.warn(
      `[stripe-webhook] payment_intent.succeeded pi=${pi.id} → order ${order.id} is '${order.paymentStatus}'; ignoring stale capture event`,
    )
    return
  }
  if (order.paymentStatus === 'succeeded') return

  await prisma.printOrder.update({
    where: { id: order.id },
    data: { paymentStatus: 'succeeded' },
  })
  // Reaching here means admin capturePayment died between the Stripe capture
  // and its DB writes (the normal path already stamped 'succeeded' and was
  // no-opped above). Repair the edition ledger too, or the captured order's
  // number stays 'reserved' forever — mis-swept by reconciliation and absent
  // from edition-sales. Idempotent: only flips rows still 'reserved'.
  await markEditionNumberSold(pi.id)
  await logOrderEvent({
    orderId: order.id,
    kind: 'captured',
    actor: 'stripe',
    message: 'Buyer card captured',
    payload: { paymentIntentId: pi.id },
  })
}
