'use server'

import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { summarizeConfig, type SpecsSummary, type WizardConfig } from '@/lib/print-providers'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { sendAdminOrderCancelledAlert } from '@/lib/emails/adminOrderCancelled'
import { sendArtistPayoutEmail } from '@/lib/emails/artistPayout'
import { sendOrderCancelledEmail } from '@/lib/emails/orderCancelled'
import { sendOrderDeliveredEmail } from '@/lib/emails/orderDelivered'
import { sendOrderInProductionEmail } from '@/lib/emails/orderInProduction'
import { sendOrderShippedEmail } from '@/lib/emails/orderShipped'
import { sendRefundIssuedEmail } from '@/lib/emails/refundIssued'
import { captureError } from '@/lib/observability/captureError'
import { logOrderEvent } from '@/lib/orders/logOrderEvent'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

export type AdminOrderRow = {
  id: string
  paymentIntentId: string
  createdAt: string
  artwork: { id: string; slug: string | null; title: string | null }
  artist: {
    id: string
    name: string
    stripeAccountId: string | null
    stripeOnboardingComplete: boolean
  }
  buyerEmail: string
  buyerName: string
  country: string
  totalCents: number
  artistCents: number
  currency: string
  paymentStatus: string
  fulfillmentStatus: string | null
  trackingUrl: string | null
  shippedAt: string | null
  transferId: string | null
  transferStatus: string | null
  paidOutAt: string | null
  latestEvent: { kind: string; message: string | null; at: string } | null
}

async function requireAdminSession() {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: 'Not signed in.' }
  if (!isAdminOrAbove(session.user.userType)) {
    return { ok: false as const, error: 'Admin access required.' }
  }
  return { ok: true as const, session }
}

export async function listOrders(): Promise<
  { ok: true; orders: AdminOrderRow[] } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const rows = await prisma.printOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      artwork: { select: { id: true, slug: true, title: true } },
      artistUser: {
        select: {
          id: true,
          name: true,
          lastName: true,
          stripeAccountId: true,
          stripeOnboardingComplete: true,
        },
      },
      events: {
        orderBy: { at: 'desc' },
        take: 1,
        select: { kind: true, message: true, at: true },
      },
    },
  })

  const orders: AdminOrderRow[] = rows.map((r) => ({
    id: r.id,
    paymentIntentId: r.paymentIntentId,
    createdAt: r.createdAt.toISOString(),
    artwork: {
      id: r.artwork.id,
      slug: r.artwork.slug,
      title: r.artwork.title,
    },
    artist: {
      id: r.artistUser.id,
      name: `${r.artistUser.name} ${r.artistUser.lastName}`.trim(),
      stripeAccountId: r.artistUser.stripeAccountId,
      stripeOnboardingComplete: r.artistUser.stripeOnboardingComplete,
    },
    buyerEmail: r.buyerEmail,
    buyerName: r.buyerName,
    country: r.country,
    totalCents: r.totalCents,
    artistCents: r.artistCents,
    currency: r.currency,
    paymentStatus: r.paymentStatus,
    fulfillmentStatus: r.fulfillmentStatus,
    trackingUrl: r.trackingUrl,
    shippedAt: r.shippedAt?.toISOString() ?? null,
    transferId: r.transferId,
    transferStatus: r.transferStatus,
    paidOutAt: r.paidOutAt?.toISOString() ?? null,
    latestEvent: r.events[0]
      ? { kind: r.events[0].kind, message: r.events[0].message, at: r.events[0].at.toISOString() }
      : null,
  }))

  return { ok: true, orders }
}

export type AdminOrderEvent = {
  id: string
  at: string
  kind: string
  actor: string
  message: string | null
  payload: unknown
}

export type AdminOrderDetail = AdminOrderRow & {
  shippingAddress: unknown
  printConfig: unknown
  productionCents: number
  productionShippingCents: number
  galleryCents: number
  customerVatCents: number
  /** Server-rendered spec rows (Print type / Paper / Frame / Glass / etc.)
   *  derived from `printConfig` + the catalog. The admin pastes these
   *  into theprintspace's "Order Prints" form. */
  specs: SpecsSummary
  /** R2 URL of the print-master image (original) the admin uploads to TPS. */
  assetUrl: string | null
  /** Web-sized thumbnail for visual ID at the top of the detail page. */
  thumbnailUrl: string | null
  certificateUrl: string | null
  events: AdminOrderEvent[]
}

export type AdminPayoutRow = {
  orderId: string
  paidOutAt: string
  artistName: string
  artistEmail: string | null
  artworkTitle: string
  artworkSlug: string | null
  amountCents: number
  currency: string
  /** Stripe Transfer ID for Connect payouts. Null for manual payouts. */
  transferId: string | null
  transferStatus: string | null
}

/**
 * Returns every released artist payout, newest first. Used by the
 * /admin/payouts page for tax/accounting records. Only includes orders
 * where `transferId` is non-null (i.e. money has actually moved).
 */
export async function listArtistPayouts(): Promise<
  { ok: true; payouts: AdminPayoutRow[] } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const rows = await prisma.printOrder.findMany({
    // Both Stripe Connect transfers and out-of-band manual payments
    // stamp paidOutAt — that's the universal "the artist has been paid"
    // signal. transferId only tracks the Stripe path.
    where: { paidOutAt: { not: null } },
    orderBy: { paidOutAt: 'desc' },
    take: 500,
    include: {
      artwork: { select: { title: true, slug: true } },
      artistUser: { select: { name: true, lastName: true, email: true } },
    },
  })

  const payouts: AdminPayoutRow[] = rows.map((r) => ({
    orderId: r.id,
    paidOutAt: (r.paidOutAt ?? r.updatedAt).toISOString(),
    artistName: `${r.artistUser.name} ${r.artistUser.lastName}`.trim(),
    artistEmail: r.artistUser.email ?? null,
    artworkTitle: r.artwork.title ?? r.artwork.slug ?? '(untitled)',
    artworkSlug: r.artwork.slug,
    amountCents: r.artistCents,
    currency: r.currency,
    transferId: r.transferId,
    transferStatus: r.transferStatus,
  }))

  return { ok: true, payouts }
}

export async function getOrderDetail(
  orderId: string,
): Promise<{ ok: true; order: AdminOrderDetail } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const r = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      artwork: {
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          originalImageUrl: true,
        },
      },
      artistUser: {
        select: {
          id: true,
          name: true,
          lastName: true,
          stripeAccountId: true,
          stripeOnboardingComplete: true,
        },
      },
      events: { orderBy: { at: 'desc' } },
    },
  })
  if (!r) return { ok: false, error: 'Order not found.' }

  // Spec rows for the "For TPS placement" panel. Derived from the
  // stored wizardConfig + the live catalog so the labels stay in sync
  // even if option labels change after the order was placed. Falls
  // back to an empty array on any catalog/render error — admin can
  // still read the raw printConfig in the timeline payload.
  let specs: SpecsSummary = []
  try {
    const catalog = await loadProviderCatalog('printspace', {
      imageWidthPx: 1000,
      imageHeightPx: 1000,
    })
    specs = summarizeConfig(catalog, r.printConfig as WizardConfig)
  } catch {
    // non-fatal
  }

  const order: AdminOrderDetail = {
    id: r.id,
    paymentIntentId: r.paymentIntentId,
    createdAt: r.createdAt.toISOString(),
    artwork: { id: r.artwork.id, slug: r.artwork.slug, title: r.artwork.title },
    artist: {
      id: r.artistUser.id,
      name: `${r.artistUser.name} ${r.artistUser.lastName}`.trim(),
      stripeAccountId: r.artistUser.stripeAccountId,
      stripeOnboardingComplete: r.artistUser.stripeOnboardingComplete,
    },
    buyerEmail: r.buyerEmail,
    buyerName: r.buyerName,
    country: r.country,
    totalCents: r.totalCents,
    artistCents: r.artistCents,
    currency: r.currency,
    paymentStatus: r.paymentStatus,
    fulfillmentStatus: r.fulfillmentStatus,
    trackingUrl: r.trackingUrl,
    shippedAt: r.shippedAt?.toISOString() ?? null,
    transferId: r.transferId,
    transferStatus: r.transferStatus,
    paidOutAt: r.paidOutAt?.toISOString() ?? null,
    latestEvent: r.events[0]
      ? { kind: r.events[0].kind, message: r.events[0].message, at: r.events[0].at.toISOString() }
      : null,
    shippingAddress: r.shippingAddress,
    printConfig: r.printConfig,
    productionCents: r.productionCents,
    productionShippingCents: r.productionShippingCents,
    galleryCents: r.galleryCents,
    customerVatCents: r.customerVatCents,
    specs,
    assetUrl: r.artwork.originalImageUrl ?? r.artwork.imageUrl ?? null,
    thumbnailUrl: r.artwork.imageUrl ?? r.artwork.originalImageUrl ?? null,
    certificateUrl: r.certificateUrl,
    events: r.events.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      kind: e.kind,
      actor: e.actor,
      message: e.message,
      payload: e.payload,
    })),
  }

  return { ok: true, order }
}

/**
 * Manual fulfillment stage. The admin advances each order by hand from
 * the detail page. Stored on PrintOrder.fulfillmentStatus.
 */
const STAGE_PENDING = null // buyer paid, not yet placed at TPS
const STAGE_PLACED = 'Placed' // admin placed at TPS; payment captured
const STAGE_STARTED = 'Started' // TPS started production
const STAGE_SHIPPED = 'Shipped' // TPS shipped
const STAGE_COMPLETE = 'Complete' // delivered; 14-day payout clock starts
const STAGE_REJECTED = 'Rejected' // admin marked rejected / cancelled

/**
 * Release the artist's cut for a delivered order. Preconditions:
 *   - payment succeeded (status = 'succeeded')
 *   - fulfillment Complete (delivered)
 *   - artist has a Connect account with onboarding complete
 *   - transfer hasn't already been sent
 *
 * Creates a Stripe Transfer from our balance to the artist's connected
 * account, stamping transferId + paidOutAt on the PrintOrder.
 */
export async function releasePayout(
  orderId: string,
): Promise<{ ok: true; transferId: string } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      artistUser: {
        select: { stripeAccountId: true, stripeOnboardingComplete: true, name: true, email: true },
      },
      artwork: { select: { title: true, slug: true } },
    },
  })
  if (!order) return { ok: false, error: 'Order not found.' }

  if (order.paymentStatus !== 'succeeded') {
    return { ok: false, error: `Payment not succeeded (status: ${order.paymentStatus}).` }
  }
  if (order.fulfillmentStatus !== STAGE_COMPLETE) {
    return {
      ok: false,
      error: `Order is "${order.fulfillmentStatus ?? 'pending'}"; wait until Complete before releasing.`,
    }
  }
  if (order.transferId) {
    return { ok: false, error: `Payout already released (${order.transferId}).` }
  }
  const artistAccountId = order.artistUser.stripeAccountId
  if (!artistAccountId || !order.artistUser.stripeOnboardingComplete) {
    return { ok: false, error: 'Artist has not completed Stripe Connect onboarding.' }
  }
  if (order.artistCents <= 0) {
    return { ok: false, error: 'Artist amount is zero.' }
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: order.artistCents,
        currency: order.currency,
        destination: artistAccountId,
        transfer_group: order.paymentIntentId,
        description: `Artist payout for order ${order.id}`,
        metadata: { orderId: order.id, paymentIntentId: order.paymentIntentId },
      },
      { idempotencyKey: `payout:${order.id}` },
    )

    await prisma.printOrder.update({
      where: { id: order.id },
      data: {
        transferId: transfer.id,
        transferStatus: 'paid',
        paidOutAt: new Date(),
      },
    })

    const session = guard.session
    await logOrderEvent({
      orderId: order.id,
      kind: 'admin_action',
      actor: `admin:${session.user.id}`,
      message: 'Payout released',
      payload: { transferId: transfer.id, amountCents: order.artistCents },
    })

    if (order.artistUser.email) {
      const emailRes = await sendArtistPayoutEmail({
        to: order.artistUser.email,
        artistFirstName: order.artistUser.name ?? '',
        artworkTitle: order.artwork.title ?? order.artwork.slug ?? '(untitled)',
        amountCents: order.artistCents,
        currency: order.currency,
        transferId: transfer.id,
      })
      await logOrderEvent({
        orderId: order.id,
        kind: emailRes.ok ? 'email_sent' : 'email_failed',
        actor: 'system',
        message: 'artist_payout',
        payload: emailRes.ok
          ? { to: order.artistUser.email, resendId: emailRes.id }
          : { to: order.artistUser.email, error: emailRes.error },
      })
    }

    return { ok: true, transferId: transfer.id }
  } catch (err) {
    console.error(`[releasePayout] order=${order.id} failed:`, err)
    captureError(err, {
      flow: 'admin',
      stage: 'release-payout',
      extra: {
        orderId: order.id,
        artistUserId: order.artistUserId,
        artistAccountId,
        amountCents: order.artistCents,
      },
      level: 'error',
      fingerprint: ['admin:release-payout-failed'],
    })
    return { ok: false, error: 'Stripe transfer failed. Check server logs.' }
  }
}

/**
 * Record an out-of-band artist payment (Wise, SEPA, PayPal, cash, etc.)
 * for cases where the admin paid the artist outside of Stripe Connect.
 *
 * Mirrors `releasePayout` for state-keeping but skips the Stripe
 * transfer call: stamps `paidOutAt` and `transferStatus = 'paid_manual'`
 * so the order moves to the Done bucket and shows up in the payouts
 * history. `transferId` stays null — there is no Stripe transfer.
 *
 * Method / reference / note are captured in the event log payload only;
 * the artist isn't auto-emailed because the admin presumably already
 * notified them when sending the money out-of-band.
 */
export async function markPaidManually(
  orderId: string,
  opts: { method: string; reference?: string; note?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const method = (opts.method ?? '').trim()
  if (!method) return { ok: false, error: 'A payment method is required (e.g. SEPA, Wise).' }

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }

  if (order.paymentStatus !== 'succeeded') {
    return { ok: false, error: `Payment not succeeded (status: ${order.paymentStatus}).` }
  }
  if (order.fulfillmentStatus !== STAGE_COMPLETE) {
    return {
      ok: false,
      error: `Order is "${order.fulfillmentStatus ?? 'pending'}"; wait until Complete before recording a payout.`,
    }
  }
  if (order.paidOutAt) {
    return {
      ok: false,
      error: order.transferId
        ? `Already paid via Stripe (${order.transferId}).`
        : 'Already marked paid manually.',
    }
  }
  if (order.artistCents <= 0) {
    return { ok: false, error: 'Artist amount is zero.' }
  }

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      transferStatus: 'paid_manual',
      paidOutAt: new Date(),
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: `Marked paid manually via ${method}`,
    payload: {
      method,
      reference: opts.reference?.trim() || undefined,
      note: opts.note?.trim() || undefined,
      amountCents: order.artistCents,
      currency: order.currency,
    },
  })

  return { ok: true }
}

/**
 * Full refund of a buyer's order. Handles both pre-capture (authorized,
 * no money moved) and post-capture (succeeded, money in our balance)
 * states.
 *
 * If the artist payout has already been released, we still allow the
 * refund but surface a warning in the event log so the team knows to
 * chase the artist's share separately.
 */
export async function refundOrder(
  orderId: string,
  opts: { reason: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard
  const adminId = guard.session.user.id

  const reason = (opts.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'A reason is required for the audit log.' }

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.paymentStatus === 'refunded') {
    return { ok: false, error: 'Order is already refunded.' }
  }
  if (order.paymentStatus === 'canceled') {
    return { ok: false, error: 'Order was already canceled (no charge to refund).' }
  }
  if (order.paymentStatus === 'failed') {
    return { ok: false, error: 'Payment never succeeded — nothing to refund.' }
  }

  try {
    if (order.paymentStatus === 'authorized') {
      await stripe.paymentIntents.cancel(order.paymentIntentId, {
        cancellation_reason: 'requested_by_customer',
      })
    } else {
      await stripe.refunds.create(
        {
          payment_intent: order.paymentIntentId,
          reason: 'requested_by_customer',
          metadata: { orderId: order.id, adminReason: reason.slice(0, 500) },
        },
        { idempotencyKey: `refund:${order.id}` },
      )
    }

    await prisma.printOrder.update({
      where: { id: order.id },
      data: { paymentStatus: 'refunded' },
    })

    await logOrderEvent({
      orderId: order.id,
      kind: 'admin_action',
      actor: `admin:${adminId}`,
      message: 'Refund issued',
      payload: {
        reason,
        amountCents: order.totalCents,
        payoutAlreadyReleased: !!order.transferId,
      },
    })

    if (order.buyerEmail) {
      const emailRes = await sendRefundIssuedEmail({
        to: order.buyerEmail,
        buyerName: order.buyerName,
        orderId: order.id,
        amountCents: order.totalCents,
        currency: order.currency,
      })
      await logOrderEvent({
        orderId: order.id,
        kind: emailRes.ok ? 'email_sent' : 'email_failed',
        actor: 'system',
        message: 'refund_issued',
        payload: emailRes.ok
          ? { to: order.buyerEmail, resendId: emailRes.id }
          : { to: order.buyerEmail, error: emailRes.error },
      })
    }

    return { ok: true }
  } catch (err) {
    console.error(`[refundOrder] order=${orderId} failed:`, err)
    captureError(err, {
      flow: 'admin',
      stage: 'refund-order',
      extra: {
        orderId,
        paymentIntentId: order.paymentIntentId,
        paymentStatus: order.paymentStatus,
        amountCents: order.totalCents,
        reason,
      },
      level: 'error',
      fingerprint: ['admin:refund-failed'],
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Refund failed. Check server logs.',
    }
  }
}

/**
 * Dev-only: create a fake local PrintOrder. Doesn't call any external
 * API — TPS has no sandbox. Starts the order at paymentStatus='authorized'
 * and stage=null so the admin can exercise the full manual flow on the
 * detail page (Capture & mark placed → Mark in production → Mark shipped
 * → Mark delivered) and verify the four buyer emails.
 */
export async function createTestOrder(): Promise<
  { ok: true; orderId: string } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Test orders are disabled in production.' }
  }

  const artwork = await prisma.artwork.findFirst({
    where: { OR: [{ imageUrl: { not: null } }, { originalImageUrl: { not: null } }] },
    select: {
      id: true,
      title: true,
      userId: true,
      user: { select: { name: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!artwork) {
    return { ok: false, error: 'No artworks available to use as a test item. Upload one first.' }
  }

  // Synthetic Stripe PI id — the manual `markPlaced` flow expects an
  // authorized PI it can capture; for dev-only test orders we skip the
  // real Stripe interaction. Admin who clicks "Capture & mark placed"
  // on this row will see the Stripe error inline; that's acceptable for
  // QA of the manual flow itself.
  const pi = `pi_tps_test_${Date.now()}`
  const buyerEmail = guard.session.user.email ?? 'tps-test@theartroom.gallery'
  const buyerName = guard.session.user.name ?? 'TPS Test Buyer'

  const order = await prisma.printOrder.create({
    data: {
      paymentIntentId: pi,
      artworkId: artwork.id,
      artistUserId: artwork.userId,
      buyerEmail,
      buyerName,
      shippingAddress: {
        line1: '221B Baker Street',
        line2: '',
        city: 'London',
        state: '',
        postalCode: 'NW1 6XE',
        country: 'GB',
        phone: '',
      },
      printConfig: {
        paperId: 'hahnemuhle-german-etching',
        printTypeId: 'giclee',
        widthCm: 40,
        heightCm: 30,
        formatId: 'unframed',
        orientation: 'landscape',
      },
      country: 'GB',
      totalCents: 6500,
      artistCents: 1500,
      galleryCents: 1500,
      productionCents: 3000,
      productionShippingCents: 500,
      customerVatCents: 0,
      currency: 'eur',
      paymentStatus: 'authorized',
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: 'Test order created (dev fixture)',
    payload: {},
  })

  return { ok: true, orderId: order.id }
}

/**
 * Hard-delete an order from the DB. Admin owns refund / payout reversal
 * decisions outside this flow — this just removes the order row + its
 * event history.
 *
 * Best-effort: if the buyer's card is currently authorized (hold but
 * not captured), we try to cancel the Stripe PaymentIntent first so
 * the hold releases. Failure to cancel doesn't block the delete —
 * admin chose to delete and we honour that.
 */
export async function deleteOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }

  const isTestOrder = order.paymentIntentId.startsWith('pi_tps_test_')

  // Best-effort release of the Stripe hold for live, still-authorized
  // orders. If it fails (already captured upstream, already canceled,
  // synthetic PI, etc.), we log and proceed — the admin asked for a
  // delete and shouldn't be blocked by Stripe state.
  if (!isTestOrder && order.paymentStatus === 'authorized') {
    try {
      await stripe.paymentIntents.cancel(order.paymentIntentId)
    } catch (err) {
      captureError(err, {
        flow: 'admin',
        stage: 'delete-order-cancel-pi',
        extra: { orderId, paymentIntentId: order.paymentIntentId },
        level: 'warning',
        fingerprint: ['admin:delete-cancel-pi-failed'],
      })
    }
  }

  try {
    await prisma.$transaction([
      prisma.printOrderEvent.deleteMany({ where: { orderId } }),
      prisma.printOrder.delete({ where: { id: orderId } }),
    ])
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: 'delete-order-db',
      extra: { orderId, paymentStatus: order.paymentStatus },
      level: 'error',
      fingerprint: ['admin:delete-order-db-failed'],
    })
    return {
      ok: false,
      error: `Database delete failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return { ok: true }
}

/**
 * Admin CTA: order placed at theprintspace by hand. Captures the Stripe
 * auth (auth → succeeded) and advances stage to Placed. No buyer email
 * at this stage — Placed is internal.
 */
export async function markPlaced(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.fulfillmentStatus !== STAGE_PENDING) {
    return {
      ok: false,
      error: `Already advanced past pending (status: ${order.fulfillmentStatus}).`,
    }
  }
  if (order.paymentStatus !== 'authorized') {
    return {
      ok: false,
      error: `Payment must be authorized to capture (current: ${order.paymentStatus}).`,
    }
  }

  try {
    await stripe.paymentIntents.capture(order.paymentIntentId)
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: 'mark-placed-capture',
      extra: { orderId, paymentIntentId: order.paymentIntentId },
      level: 'error',
      fingerprint: ['admin:mark-placed-capture-failed'],
    })
    return {
      ok: false,
      error: `Stripe capture failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  await prisma.printOrder.update({
    where: { id: order.id },
    data: { fulfillmentStatus: STAGE_PLACED, paymentStatus: 'succeeded' },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: 'Marked placed at The Print Space (payment captured)',
    payload: {},
  })

  return { ok: true }
}

/**
 * Admin CTA: TPS accepted the order and started production. Sets stage
 * to Started and fires the buyer's "order accepted" email.
 */
export async function markStarted(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return advanceStage(orderId, STAGE_STARTED, {
    logMessage: 'Marked in production (TPS accepted the order)',
  })
}

/**
 * Admin CTA: TPS shipped the print. Stamps trackingUrl (if provided)
 * so the buyer's "Your artwork is on its way" email links to it.
 * shippedAt is intentionally left for STAGE_COMPLETE — the column name
 * is historical, it really means "payout clock start" and we want that
 * tied to delivery, not pickup.
 */
export async function markShipped(
  orderId: string,
  trackingUrl: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedTracking = trackingUrl?.trim() || null
  return advanceStage(orderId, STAGE_SHIPPED, {
    logMessage: trimmedTracking
      ? 'Marked shipped (tracking URL recorded)'
      : 'Marked shipped (no tracking URL)',
    trackingUrl: trimmedTracking,
  })
}

/**
 * Admin CTA: the buyer received the print. Stamps the payout-clock start
 * (`shippedAt`) and fires the "Your artwork has arrived" email.
 */
export async function markDelivered(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return advanceStage(orderId, STAGE_COMPLETE, {
    logMessage: 'Marked delivered',
    setShippedAtNow: true,
  })
}

/**
 * Admin CTA: order rejected (artist disabled prints, file unusable, etc.)
 * Terminal state. If payment was still authorized we cancel the Stripe
 * PI (releases the hold); if it was already captured, admin must use
 * the existing Refund flow to return funds.
 */
export async function markRejected(
  orderId: string,
  reason: string,
): Promise<{ ok: true; needsRefund: boolean } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const trimmedReason = reason.trim()
  if (!trimmedReason) return { ok: false, error: 'A reason is required.' }

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.fulfillmentStatus === STAGE_COMPLETE || order.fulfillmentStatus === STAGE_REJECTED) {
    return {
      ok: false,
      error: `Cannot reject from stage "${order.fulfillmentStatus}".`,
    }
  }

  let voided = false
  if (order.paymentStatus === 'authorized') {
    try {
      await stripe.paymentIntents.cancel(order.paymentIntentId)
      voided = true
    } catch (err) {
      captureError(err, {
        flow: 'admin',
        stage: 'mark-rejected-cancel-pi',
        extra: { orderId, paymentIntentId: order.paymentIntentId },
        level: 'error',
        fingerprint: ['admin:mark-rejected-cancel-failed'],
      })
      return {
        ok: false,
        error: `Stripe cancel failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: STAGE_REJECTED,
      ...(voided ? { paymentStatus: 'canceled' } : {}),
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: voided
      ? 'Marked rejected (Stripe auth voided)'
      : 'Marked rejected (manual refund required)',
    payload: { reason: trimmedReason, voided, priorPaymentStatus: order.paymentStatus },
  })

  await maybeSendBuyerTransitionEmail(order.id, STAGE_REJECTED, { trackingUrl: null })

  const needsRefund = order.paymentStatus === 'succeeded' && !order.transferId
  return { ok: true, needsRefund }
}

/**
 * Shared core for the stage-advance CTAs. Validates the transition (no
 * advancing past terminal states), updates the row, logs an event, and
 * fires the buyer email if the new stage is one of the four critical
 * transitions covered by maybeSendBuyerTransitionEmail.
 */
async function advanceStage(
  orderId: string,
  newStage: string,
  opts: {
    logMessage: string
    trackingUrl?: string | null
    setShippedAtNow?: boolean
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.fulfillmentStatus === STAGE_COMPLETE || order.fulfillmentStatus === STAGE_REJECTED) {
    return {
      ok: false,
      error: `Cannot advance from terminal stage "${order.fulfillmentStatus}".`,
    }
  }

  const effectiveTrackingUrl =
    typeof opts.trackingUrl === 'string' ? opts.trackingUrl : (order.trackingUrl ?? null)

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: newStage,
      ...(opts.trackingUrl !== undefined ? { trackingUrl: opts.trackingUrl } : {}),
      ...(opts.setShippedAtNow ? { shippedAt: new Date() } : {}),
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: opts.logMessage,
    payload: {
      previousStage: order.fulfillmentStatus,
      newStage,
      trackingUrl: effectiveTrackingUrl,
    },
  })

  await maybeSendBuyerTransitionEmail(order.id, newStage, {
    trackingUrl: effectiveTrackingUrl,
  })

  return { ok: true }
}

/**
 * Send the buyer (and optionally admin) the appropriate transition
 * email for a stage change, gated by the event log so retries never
 * double-send.
 */
async function maybeSendBuyerTransitionEmail(
  orderId: string,
  newStage: string,
  opts: { trackingUrl: string | null },
): Promise<void> {
  if (
    newStage !== STAGE_STARTED &&
    newStage !== STAGE_SHIPPED &&
    newStage !== STAGE_COMPLETE &&
    newStage !== STAGE_REJECTED
  ) {
    return
  }

  const emailMessageKey =
    newStage === STAGE_STARTED
      ? 'order_in_production'
      : newStage === STAGE_SHIPPED
        ? 'order_shipped'
        : newStage === STAGE_COMPLETE
          ? 'order_delivered'
          : 'order_cancelled'

  const alreadySent = await prisma.printOrderEvent.findFirst({
    where: { orderId, kind: 'email_sent', message: emailMessageKey },
    select: { id: true },
  })
  if (alreadySent) return

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      artwork: { select: { title: true } },
      artistUser: { select: { name: true, lastName: true } },
    },
  })
  if (!order || !order.buyerEmail) return

  const artistName = [order.artistUser.name, order.artistUser.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()

  const emailRes =
    newStage === STAGE_STARTED
      ? await sendOrderInProductionEmail({
          to: order.buyerEmail,
          buyerName: order.buyerName,
          orderId: order.id,
          artworkTitle: order.artwork.title ?? '',
          artistName,
        })
      : newStage === STAGE_SHIPPED
        ? await sendOrderShippedEmail({
            to: order.buyerEmail,
            buyerName: order.buyerName,
            orderId: order.id,
            artworkTitle: order.artwork.title ?? '',
            artistName,
            trackingUrl: opts.trackingUrl,
          })
        : newStage === STAGE_COMPLETE
          ? await sendOrderDeliveredEmail({
              to: order.buyerEmail,
              buyerName: order.buyerName,
              orderId: order.id,
              artworkTitle: order.artwork.title ?? '',
              artistName,
            })
          : await sendOrderCancelledEmail({
              to: order.buyerEmail,
              buyerName: order.buyerName,
              orderId: order.id,
              artworkTitle: order.artwork.title ?? '',
              artistName,
              paymentStatus: order.paymentStatus,
            })

  await logOrderEvent({
    orderId: order.id,
    kind: emailRes.ok ? 'email_sent' : 'email_failed',
    actor: 'system',
    message: emailMessageKey,
    payload: emailRes.ok
      ? { to: order.buyerEmail, resendId: emailRes.id }
      : { to: order.buyerEmail, error: emailRes.error },
  })

  if (!emailRes.ok) {
    captureError(new Error(`Buyer ${emailMessageKey} email failed: ${emailRes.error}`), {
      flow: 'email',
      stage: `buyer-${emailMessageKey}-send`,
      extra: { orderId: order.id, to: order.buyerEmail, error: emailRes.error },
      level: 'warning',
      fingerprint: [`email:${emailMessageKey}-failed`],
    })
  }

  if (newStage === STAGE_REJECTED) {
    const adminAlreadySent = await prisma.printOrderEvent.findFirst({
      where: { orderId, kind: 'email_sent', message: 'admin_order_cancelled' },
      select: { id: true },
    })
    if (!adminAlreadySent) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
      const adminRes = await sendAdminOrderCancelledAlert({
        orderId: order.id,
        artworkTitle: order.artwork.title ?? '',
        artistName,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        paymentStatus: order.paymentStatus,
        totalCents: order.totalCents,
        currency: order.currency,
        adminOrderUrl: `${siteUrl}/admin/orders/${order.id}`,
      })
      await logOrderEvent({
        orderId: order.id,
        kind: adminRes.ok ? 'email_sent' : 'email_failed',
        actor: 'system',
        message: 'admin_order_cancelled',
        payload: adminRes.ok ? { resendId: adminRes.id } : { error: adminRes.error },
      })
      if (!adminRes.ok) {
        captureError(new Error(`Admin cancellation alert failed: ${adminRes.error}`), {
          flow: 'email',
          stage: 'admin-order-cancelled-send',
          extra: { orderId: order.id, error: adminRes.error },
          level: 'warning',
          fingerprint: ['email:admin-order-cancelled-failed'],
        })
      }
    }
  }
}
