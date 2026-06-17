import { bindEditionNumbersToOrderItem } from '@/lib/editions/reserveEditionNumber'
import { sendAdminCartOrderNotification } from '@/lib/emails/adminCartOrderNotification'
import type { AdminCartOrderLine } from '@/lib/emails/adminCartOrderNotification'
import { sendAdminCriticalAlert } from '@/lib/emails/adminCriticalAlert'
import { sendCartOrderPlacedEmail } from '@/lib/emails/cartOrderPlaced'
import type { CartOrderPlacedLine } from '@/lib/emails/cartOrderPlaced'
import { captureError } from '@/lib/observability/captureError'
import type { SpecsSummary, WizardConfig } from '@/lib/print-providers'
import { summarizeConfig } from '@/lib/print-providers'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import prisma from '@/lib/prisma'
import { logOrderEvent } from './logOrderEvent'

/**
 * One validated cart line as persisted on the PendingCart `items` JSON by
 * createCartPaymentIntent. Mirrors that writer's shape exactly.
 */
type CartItem = {
  lineId: string
  artworkId: string
  artistUserId: string
  variantId?: string | null
  editionType: 'open' | 'limited'
  printConfig: WizardConfig
  quantity: number
  productionCents: number
  artistCents: number
  galleryCents: number
  editionNumberIds: string[]
}

/**
 * Minimal PaymentIntent shape the cart builder needs. Everything else
 * (buyer, address, money, items) comes from the PendingCart row, so we only
 * read the PI id. Mirrors the local-shape convention used by
 * createPrintOrderFromPaymentIntent + the webhook route rather than pulling
 * stripe's resource types (awkward to reference as a namespace in v22).
 */
type CartPaymentIntent = {
  id: string
  metadata?: Record<string, string>
}

/**
 * Called from the `payment_intent.amount_capturable_updated` webhook once a
 * CART buyer's card is authorized (funds held, not captured). Builds the
 * multi-item PrintOrder + PrintOrderItem rows from the PendingCart row that
 * createCartPaymentIntent staged at PI-creation time.
 *
 * Cart analogue of createPrintOrderFromPaymentIntent. Same conventions:
 * upsert keyed on paymentIntentId for webhook-retry idempotency, email
 * gating via the event log so a redelivery never re-emails, logOrderEvent
 * for the timeline, and sendAdminCriticalAlert for problems that leave the
 * buyer held with a broken order.
 *
 * MANUAL FULFILLMENT MODE: auto-submit is disabled. Buyer's card stays
 * authorized; admin captures manually from Stripe when they place each
 * upstream order at TPS. See memory/project_manual_fulfillment_launch.md.
 *
 * Idempotency: PrintOrder existence (keyed on paymentIntentId) is the
 * authoritative key. A webhook redelivery AFTER the PendingCart row was
 * already consumed + deleted finds the existing order and no-ops, rather
 * than mistaking the (correctly) missing PendingCart for a failure.
 */
export async function createPrintOrderFromCart(
  pi: CartPaymentIntent,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  // ── 1. Load the staged cart, with order-existence as the idempotency key.
  const pending = await prisma.pendingCart.findUnique({
    where: { paymentIntentId: pi.id },
  })

  if (!pending) {
    // A webhook redelivery after we already built + deleted the cart row
    // is the EXPECTED missing-PendingCart case. Order existence is the
    // idempotency key, so check it BEFORE treating the absence as an error.
    const existing = await prisma.printOrder.findUnique({
      where: { paymentIntentId: pi.id },
      select: { id: true },
    })
    if (existing) {
      return { ok: true, orderId: existing.id }
    }

    // No PendingCart AND no order: the buyer may be authorized but we have
    // nothing to build the order from. Do NOT create a partial order — alert
    // for manual recovery.
    captureError(new Error(`Cart order has no PendingCart and no PrintOrder for pi=${pi.id}`), {
      flow: 'order',
      stage: 'cart-pending-missing',
      extra: { paymentIntentId: pi.id },
      level: 'error',
      fingerprint: ['order:cart-pending-missing'],
    })
    await sendAdminCriticalAlert({
      title: 'Cart order has no staged cart row',
      problem:
        'A cart PaymentIntent authorized but no PendingCart row exists to build the order from, and no PrintOrder exists yet either. The buyer’s card may be authorized with no order created.',
      paymentIntentId: pi.id,
      whatToDo: [
        'Open the PaymentIntent in Stripe and check whether it is in requires_capture state.',
        'If the buyer’s card is authorized, cancel the PaymentIntent in Stripe to release the hold.',
        'Contact the buyer (use the receipt_email on the PaymentIntent) to apologize and re-place the order.',
      ],
    })
    return { ok: false, error: 'No PendingCart row for cart PaymentIntent.' }
  }

  // ── 2. Parse the staged line items.
  let items: CartItem[]
  try {
    items = pending.items as unknown as CartItem[]
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('PendingCart.items is empty or not an array')
    }
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      flow: 'order',
      stage: 'cart-parse-items',
      extra: { paymentIntentId: pi.id },
      level: 'error',
      fingerprint: ['order:cart-parse-items-failed'],
    })
    await sendAdminCriticalAlert({
      title: 'Cart order items could not be parsed',
      problem: `The PendingCart row for this PaymentIntent has no usable items. ${err instanceof Error ? err.message : String(err)}`,
      paymentIntentId: pi.id,
      whatToDo: [
        'Cancel the PaymentIntent in Stripe to release the buyer’s card hold.',
        'Inspect the PendingCart row in the database for this PaymentIntent.',
        'Contact the buyer to re-place the order.',
      ],
    })
    return { ok: false, error: 'PendingCart items could not be parsed.' }
  }

  const buyerEmail = pending.buyerEmail
  const country = pending.country

  // Header rollups for the DEPRECATED required legacy per-print columns.
  // Authoritative per-item money lives on PrintOrderItem; these are header
  // representatives only (dropped in the AR-129 cleanup).
  const rollupArtistCents = items.reduce((s, it) => s + it.artistCents, 0)
  const rollupGalleryCents = items.reduce((s, it) => s + it.galleryCents, 0)
  const rollupProductionCents = items.reduce((s, it) => s + it.productionCents, 0)

  // ── 3. Build the order + items + edition binds in one transaction.
  // The created order id + each created item id are returned so we can bind
  // each limited line's held numbers to ITS OWN orderItemId and gate emails.
  let result: {
    orderId: string
    created: boolean
    itemBinds: Array<{ orderItemId: string; numberIds: string[]; expected: number }>
  }
  try {
    result = await prisma.$transaction(async (tx) => {
      // a. Upsert the order header. On a webhook retry that races a prior
      //    in-flight build, the conflict on paymentIntentId returns the
      //    existing row and we treat it as already-created (no double items).
      const before = await tx.printOrder.findUnique({
        where: { paymentIntentId: pi.id },
        select: { id: true },
      })

      const order = await tx.printOrder.upsert({
        where: { paymentIntentId: pi.id },
        create: {
          paymentIntentId: pi.id,
          buyerEmail,
          buyerName: pending.buyerName,
          shippingAddress: pending.shippingAddress ?? {},
          country,
          // DEPRECATED header rollups — see comment above. The first line is
          // the representative artwork/artist/config for the legacy columns.
          artworkId: items[0].artworkId,
          artistUserId: items[0].artistUserId,
          printConfig: items[0].printConfig as unknown as object,
          totalCents: pending.totalCents,
          artistCents: rollupArtistCents,
          galleryCents: rollupGalleryCents,
          productionCents: rollupProductionCents,
          productionShippingCents: pending.shippingCents,
          customerVatCents: pending.customerVatCents,
          currency: pending.currency,
          paymentStatus: 'authorized',
        },
        // Don't downgrade — if we're already 'succeeded' (captured) keep it.
        update: {},
      })

      // If the order already existed before this upsert, its items were
      // already created by the prior run — do not create them again.
      if (before) {
        return { orderId: order.id, created: false, itemBinds: [] }
      }

      // b. Create N PrintOrderItem rows, capturing each id alongside its
      //    source line so limited holds bind to the right item.
      const itemBinds: Array<{ orderItemId: string; numberIds: string[]; expected: number }> = []
      for (const line of items) {
        const item = await tx.printOrderItem.create({
          data: {
            orderId: order.id,
            artworkId: line.artworkId,
            artistUserId: line.artistUserId,
            printConfig: line.printConfig as unknown as object,
            quantity: line.quantity,
            productionCents: line.productionCents,
            artistCents: line.artistCents,
            galleryCents: line.galleryCents,
          },
        })
        if (line.editionType === 'limited' && line.editionNumberIds.length > 0) {
          itemBinds.push({
            orderItemId: item.id,
            numberIds: line.editionNumberIds,
            expected: line.editionNumberIds.length,
          })
        }
      }

      return { orderId: order.id, created: true, itemBinds }
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      flow: 'order',
      stage: 'cart-upsert-order',
      extra: { paymentIntentId: pi.id, lineCount: items.length },
      level: 'error',
      fingerprint: ['order:cart-upsert-failed'],
    })
    await sendAdminCriticalAlert({
      title: 'Database write failed for paid cart order',
      problem: `Could not persist the cart PrintOrder + items. ${err instanceof Error ? err.message : String(err)}`,
      paymentIntentId: pi.id,
      context: { buyerEmail, buyerName: pending.buyerName, lineCount: items.length },
      whatToDo: [
        'Check the database is healthy (Supabase status page).',
        'The Stripe webhook will retry, so this may resolve itself within minutes.',
        'The PendingCart row is preserved so a retry can rebuild — do not delete it by hand.',
        'If you keep seeing this alert for the same PI, cancel the PaymentIntent in Stripe and contact the buyer.',
      ],
    })
    // Leave the PendingCart row in place so a webhook retry can rebuild.
    return { ok: false, error: 'Database write failed.' }
  }

  // ── 3c. Bind each limited line's held numbers to ITS OWN orderItemId.
  // Done outside the transaction (it only matters on the first build; a
  // retry has created=false and an empty itemBinds). A count mismatch flags
  // the line for manual reconciliation but does NOT fail the order — the
  // order + payment are valid, mirroring the single-print bind-failure path.
  if (result.created) {
    for (const bind of result.itemBinds) {
      // bindEditionNumbersToOrderItem binds per-number and is written not to
      // throw, but guard the call anyway: a throw here (e.g. a DB error) must
      // be treated like a count mismatch (alert + reconcile), NOT rethrown.
      // The order + payment are already valid; rethrowing would skip the
      // buyer/admin emails and, on webhook redelivery, the existing order
      // short-circuits binding so the numbers would never bind or email.
      let bound = 0
      try {
        bound = await bindEditionNumbersToOrderItem({
          numberIds: bind.numberIds,
          orderItemId: bind.orderItemId,
          buyerEmail,
        })
      } catch (err) {
        captureError(err instanceof Error ? err : new Error(String(err)), {
          flow: 'order',
          stage: 'cart-bind-edition-numbers',
          extra: { paymentIntentId: pi.id, orderItemId: bind.orderItemId },
          level: 'error',
          fingerprint: ['order:cart-bind-edition-numbers-threw'],
        })
        bound = 0
      }
      if (bound !== bind.expected) {
        await logOrderEvent({
          orderId: result.orderId,
          kind: 'edition_reserved',
          actor: 'system',
          message: `Edition bind mismatch on item ${bind.orderItemId}: bound ${bound} of ${bind.expected}`,
          payload: { orderItemId: bind.orderItemId, bound, expected: bind.expected },
        })
        await sendAdminCriticalAlert({
          title: 'Cart order edition number bind mismatch',
          problem:
            'A limited-edition cart line authorized, but fewer of its reserved edition numbers were still held than expected (some were released before auth landed). The order exists but is not fully bound.',
          paymentIntentId: pi.id,
          context: {
            orderId: result.orderId,
            orderItemId: bind.orderItemId,
            bound,
            expected: bind.expected,
          },
          whatToDo: [
            'Open the order in /admin/orders and the affected variant in the dashboard.',
            'Confirm which edition numbers this buyer should receive (the next available).',
            'Bind them manually in the database and mirror them as sold in TPS.',
          ],
        })
      } else {
        await logOrderEvent({
          orderId: result.orderId,
          kind: 'edition_reserved',
          actor: 'system',
          message: `Bound ${bound} edition number(s) to item ${bind.orderItemId}`,
          payload: { orderItemId: bind.orderItemId, bound },
        })
      }
    }
    // NOTE: the 'auth_received' timeline event is logged uniformly by the
    // webhook route (handlePaymentIntentAuthorized) for BOTH the cart and
    // single-print paths once the builder returns ok. Do not log it here too
    // — the single-print builder doesn't, and a self-log would put two
    // auth_received entries on every cart order's timeline.
  }

  // ── 3d. Consume the staged cart now that a valid order exists. Reached
  // only after a successful build (failures return early), so deleting here
  // is safe whether this is the first build OR a retry that found the order
  // already created but a still-present PendingCart (e.g. a prior run crashed
  // between commit and this delete). Idempotent — a redelivery that already
  // deleted it just no-ops.
  await prisma.pendingCart
    .delete({ where: { paymentIntentId: pi.id } })
    .catch((err) => console.warn('[createPrintOrderFromCart] PendingCart delete failed:', err))

  // ── 4. Resolve artwork titles + artist names for the emails. One query.
  const artworkIds = Array.from(new Set(items.map((it) => it.artworkId)))
  const artworks = await prisma.artwork.findMany({
    where: { id: { in: artworkIds } },
    select: {
      id: true,
      title: true,
      originalWidth: true,
      originalHeight: true,
      user: { select: { name: true, lastName: true } },
    },
  })
  const artworkById = new Map(artworks.map((a) => [a.id, a]))
  const artistNameFor = (artworkId: string): string => {
    const a = artworkById.get(artworkId)
    return [a?.user?.name, a?.user?.lastName].filter(Boolean).join(' ').trim()
  }
  const artworkTitleFor = (artworkId: string): string => artworkById.get(artworkId)?.title ?? ''

  // ── 5. Buyer confirmation email — gated by the event log so a webhook
  // redelivery never re-emails. Lists every purchased line.
  const alreadyEmailed = await prisma.printOrderEvent.findFirst({
    where: { orderId: result.orderId, kind: 'email_sent', message: 'order_placed' },
    select: { id: true },
  })
  if (!alreadyEmailed && buyerEmail) {
    const lines: CartOrderPlacedLine[] = items.map((it) => ({
      artworkTitle: artworkTitleFor(it.artworkId),
      artistName: artistNameFor(it.artworkId),
      quantity: it.quantity,
    }))
    const emailRes = await sendCartOrderPlacedEmail({
      to: buyerEmail,
      buyerName: pending.buyerName,
      orderId: result.orderId,
      lines,
      totalCents: pending.totalCents,
      currency: pending.currency,
      shippingCountryCode: country,
    })
    await logOrderEvent({
      orderId: result.orderId,
      kind: emailRes.ok ? 'email_sent' : 'email_failed',
      actor: 'system',
      message: 'order_placed',
      payload: emailRes.ok
        ? { to: buyerEmail, resendId: emailRes.id }
        : { to: buyerEmail, error: emailRes.error },
    })
    if (!emailRes.ok) {
      captureError(new Error(`Cart order-placed email failed: ${emailRes.error}`), {
        flow: 'email',
        stage: 'cart-order-placed-send',
        extra: { orderId: result.orderId, to: buyerEmail, error: emailRes.error },
        level: 'warning',
        fingerprint: ['email:cart-order-placed-failed'],
      })
    }
  }

  // ── 6. Admin notification — idempotent via the event log, same as above.
  // Lists every line with its own derived specs. Specs are display-only; a
  // catalog/summarize failure falls back to an empty spec list rather than
  // failing the email (mirrors the single-print path).
  const alreadyNotifiedAdmin = await prisma.printOrderEvent.findFirst({
    where: { orderId: result.orderId, kind: 'email_sent', message: 'admin_order_notification' },
    select: { id: true },
  })
  if (!alreadyNotifiedAdmin) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
    const adminLines: AdminCartOrderLine[] = []
    for (const it of items) {
      let specs: SpecsSummary = []
      try {
        const art = artworkById.get(it.artworkId)
        const catalog = await loadProviderCatalog('printspace', {
          imageWidthPx: art?.originalWidth ?? 1000,
          imageHeightPx: art?.originalHeight ?? 1000,
        })
        specs = summarizeConfig(catalog, it.printConfig)
      } catch (err) {
        captureError(err instanceof Error ? err : new Error(String(err)), {
          flow: 'order',
          stage: 'cart-derive-specs',
          extra: { paymentIntentId: pi.id, artworkId: it.artworkId },
          level: 'warning',
        })
      }
      adminLines.push({
        artworkTitle: artworkTitleFor(it.artworkId),
        artistName: artistNameFor(it.artworkId),
        quantity: it.quantity,
        skuAttributes: Object.fromEntries(specs.map((row) => [row.label, row.value])),
      })
    }

    const addr = (pending.shippingAddress ?? {}) as Record<string, unknown>
    const adminRes = await sendAdminCartOrderNotification({
      orderId: result.orderId,
      lines: adminLines,
      buyerName: pending.buyerName,
      buyerEmail,
      shippingAddress: {
        line1: String(addr.address1 ?? ''),
        line2: String(addr.address2 ?? ''),
        city: String(addr.city ?? ''),
        state: String(addr.stateOrRegion ?? ''),
        postalCode: String(addr.postalCode ?? ''),
        country,
        phone: String(addr.phone ?? ''),
      },
      totalCents: pending.totalCents,
      currency: pending.currency,
      adminOrderUrl: `${siteUrl}/admin/orders/${result.orderId}`,
    })
    await logOrderEvent({
      orderId: result.orderId,
      kind: adminRes.ok ? 'email_sent' : 'email_failed',
      actor: 'system',
      message: 'admin_order_notification',
      payload: adminRes.ok ? { resendId: adminRes.id } : { error: adminRes.error },
    })
    if (!adminRes.ok) {
      captureError(new Error(`Admin cart order-notification email failed: ${adminRes.error}`), {
        flow: 'email',
        stage: 'admin-cart-order-notification-send',
        extra: { orderId: result.orderId, error: adminRes.error },
        level: 'warning',
        fingerprint: ['email:admin-cart-order-notification-failed'],
      })
    }
  }

  return { ok: true, orderId: result.orderId }
}
