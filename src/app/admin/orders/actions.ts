'use server'

import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { summarizeConfig, type SpecsSummary, type WizardConfig } from '@/lib/print-providers'
import { TPS_PAPERS, TPS_PRINT_TYPES } from '@/lib/print-providers/printspace'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { sendAdminOrderCancelledAlert } from '@/lib/emails/adminOrderCancelled'
import { sendArtistPayoutEmail } from '@/lib/emails/artistPayout'
import { sendOrderCancelledEmail } from '@/lib/emails/orderCancelled'
import { sendOrderDeliveredEmail } from '@/lib/emails/orderDelivered'
import { sendOrderInProductionEmail } from '@/lib/emails/orderInProduction'
import { sendOrderShippedEmail } from '@/lib/emails/orderShipped'
import { sendRefundIssuedEmail } from '@/lib/emails/refundIssued'
import { markEditionNumberSold } from '@/lib/editions/reserveEditionNumber'
import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
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
  /** Number of PrintOrderItem line rows. 0 = legacy single-print order
   *  (data on the header), > 0 = cart order. */
  itemCount: number
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
      _count: { select: { items: true } },
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
    itemCount: r._count.items,
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

/** One line of a multi-item (cart) order, sourced from PrintOrderItem.
 *  The authoritative per-line data for cart orders. Empty on legacy
 *  single-print orders. */
export type AdminOrderItem = {
  id: string
  artworkTitle: string
  artworkSlug: string | null
  artistName: string
  quantity: number
  productionCents: number
  artistCents: number
  galleryCents: number
  /** Per-item Stripe Connect payout (cart orders pay each artist
   *  independently, so an order can be partly paid out). */
  transferId: string | null
  transferStatus: string | null
  paidOutAt: string | null
  /** Display-only spec rows derived from this line's printConfig + the
   *  live catalog. Empty fallback on any catalog/summarize failure. */
  specsSummary: SpecsSummary
  /** Edition labels like ['29/50', '30/50'] for limited lines; empty for
   *  open editions. */
  editionLabels: string[]
  /** Copy-ready TPS manual-fulfillment lines, one per numbered copy on a
   *  limited line (e.g. ['Giclée · ... · 29/50', '... · 30/50']). Empty for
   *  open editions. Mirrors the legacy single-print `edition.tpsSku` so the
   *  admin gets the same paste-ready line per cart item. */
  tpsSkus: string[]
}

export type AdminOrderDetail = AdminOrderRow & {
  shippingAddress: unknown
  printConfig: unknown
  productionCents: number
  productionShippingCents: number
  galleryCents: number
  customerVatCents: number
  /** True when the order has PrintOrderItem rows (cart order). The UI
   *  branches on this: cart → line-items table; legacy → single artwork
   *  + config block. */
  isCart: boolean
  /** Per-line items for cart orders; empty array for legacy single-print
   *  orders (all data is on the header fields above). */
  items: AdminOrderItem[]
  /** Server-rendered spec rows (Print type / Paper / Frame / Glass / etc.)
   *  derived from `printConfig` + the catalog. The admin pastes these
   *  into theprintspace's "Order Prints" form. */
  specs: SpecsSummary
  /** R2 URL of the print-master image (original) the admin uploads to TPS. */
  assetUrl: string | null
  /** Web-sized thumbnail for visual ID at the top of the detail page. */
  thumbnailUrl: string | null
  /** Limited-edition fulfillment block. Null for open editions. The admin
   *  pastes `tpsSku` into TPS's Sell-as-Print manual order and ticks the
   *  edition number as sold. */
  edition: {
    variantName: string
    number: number
    editionSize: number
    state: string
    label: string // "Small #7/50"
    tpsSku: string // copy-ready manual-fulfillment line
    mirroredInTpsAt: string | null
  } | null
  events: AdminOrderEvent[]
}

export type AdminPayoutRow = {
  /** Stable React key. Per-order for legacy header payouts, per-item for
   *  cart payouts (so one cart order can contribute several rows). transferId
   *  is unsuitable as a key because manual payouts leave it null. */
  rowKey: string
  /** 'header' = legacy single-print order payout; 'item' = one cart line. */
  source: 'header' | 'item'
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
 * /admin/payouts page for tax/accounting records.
 *
 * UNION of two sources, one AdminPayoutRow per actual payout:
 *   - legacy single-print orders, where the payout is stamped on the
 *     PrintOrder header, and
 *   - cart orders, where each PrintOrderItem is paid independently and the
 *     payout is stamped per line.
 *
 * "Money actually moved" = paidOutAt set. This is the universal paid signal
 * for both Stripe Connect transfers (transferId set) and out-of-band manual
 * payments (transferStatus 'paid_manual', transferId null), so manual
 * payouts stay listed as before. Cart orders may contribute several rows —
 * one per paid line.
 *
 * The two sources are over-fetched (PAYOUT_PAGE each) then merged, globally
 * re-sorted by paidOutAt, and sliced to PAYOUT_PAGE so the result is a TRUE
 * global newest-N — never a per-source cutoff that could drop a recent payout
 * from one source while showing an older one from the other.
 */
const PAYOUT_PAGE = 500
export async function listArtistPayouts(): Promise<
  { ok: true; payouts: AdminPayoutRow[] } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  // Legacy header payouts (single-print orders only). paidOutAt covers both
  // the Stripe path (transferId set) and manual payouts (transferId null) —
  // identical to the prior behaviour so nothing single-print regresses.
  // `items: none` excludes cart orders so we never list a cart's deprecated
  // header rollup alongside its authoritative per-item rows.
  const headerRows = await prisma.printOrder.findMany({
    where: { paidOutAt: { not: null }, items: { none: {} } },
    orderBy: { paidOutAt: 'desc' },
    take: PAYOUT_PAGE,
    include: {
      artwork: { select: { title: true, slug: true } },
      artistUser: { select: { name: true, lastName: true, email: true } },
    },
  })

  // Per-item payouts for cart orders. Each paid line is its own payout
  // (Stripe transfer or manual), keyed off the same paidOutAt signal.
  const itemRows = await prisma.printOrderItem.findMany({
    where: { paidOutAt: { not: null } },
    orderBy: { paidOutAt: 'desc' },
    take: PAYOUT_PAGE,
    include: {
      order: { select: { currency: true } },
      artwork: { select: { title: true, slug: true } },
      artistUser: { select: { name: true, lastName: true, email: true } },
    },
  })

  const headerPayouts: AdminPayoutRow[] = headerRows.map((r) => ({
    rowKey: `header:${r.id}`,
    source: 'header',
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

  const itemPayouts: AdminPayoutRow[] = itemRows.map((it) => ({
    rowKey: `item:${it.id}`,
    source: 'item',
    orderId: it.orderId,
    paidOutAt: (it.paidOutAt ?? it.updatedAt).toISOString(),
    artistName: `${it.artistUser.name} ${it.artistUser.lastName}`.trim(),
    artistEmail: it.artistUser.email ?? null,
    artworkTitle: it.artwork.title ?? it.artwork.slug ?? '(untitled)',
    artworkSlug: it.artwork.slug,
    amountCents: it.artistCents,
    currency: it.order.currency,
    transferId: it.transferId,
    transferStatus: it.transferStatus,
  }))

  // Merge, globally re-sort, then slice to a true global newest-N. Slicing
  // after the merged sort (rather than relying on each source's own take)
  // guarantees the cutoff is global: if one source has > PAYOUT_PAGE rows we
  // still drop only the genuinely-oldest payouts across both sources.
  const payouts = [...headerPayouts, ...itemPayouts]
    .sort((a, b) => Date.parse(b.paidOutAt) - Date.parse(a.paidOutAt))
    .slice(0, PAYOUT_PAGE)

  return { ok: true, payouts }
}

export type EditionSaleRow = {
  /** EditionNumber PK — globally unique per numbered copy. Stable React key
   *  that never collides even when a multi-item cart holds two different
   *  variants sharing a name + number (variant names are non-unique). */
  id: string
  artworkTitle: string
  artworkSlug: string | null
  variantName: string
  number: number
  editionSize: number
  state: string // 'reserved' | 'sold'
  buyerName: string | null
  buyerEmail: string | null
  orderId: string | null
  date: string | null
  mirroredInTps: boolean
}

/**
 * The limited-edition sales ledger — every reserved/sold edition number,
 * who holds it, for which artwork + variant, and whether it's been
 * mirrored as sold in TPS. Our authoritative record of which numbered
 * copies are out there. Newest first.
 */
export async function listEditionSales(): Promise<
  { ok: true; sales: EditionSaleRow[] } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  // An EditionNumber is bound to a sale via EITHER the legacy single-print
  // path (orderId → order, AR-129-deprecated) OR the cart path
  // (orderItemId → orderItem → order). Cover both: select the parent order
  // through whichever link is present so the ledger lists every reserved/sold
  // number for both order shapes.
  const orderSelect = {
    id: true,
    buyerName: true,
    buyerEmail: true,
    createdAt: true,
    tpsEditionMirroredAt: true,
  } as const

  const rows = await prisma.editionNumber.findMany({
    where: { state: { in: ['reserved', 'sold'] } },
    orderBy: [{ soldAt: 'desc' }, { reservedAt: 'desc' }],
    take: 1000,
    include: {
      variant: { include: { artwork: { select: { title: true, slug: true } } } },
      order: { select: orderSelect },
      orderItem: { select: { order: { select: orderSelect } } },
    },
  })

  const sales: EditionSaleRow[] = rows.map((r) => {
    // Resolve the parent order from whichever binding path is present:
    // legacy single-print uses r.order; cart uses r.orderItem.order.
    const order = r.order ?? r.orderItem?.order ?? null
    return {
      id: r.id,
      artworkTitle: r.variant.artwork.title ?? '(untitled)',
      artworkSlug: r.variant.artwork.slug,
      variantName: r.variant.name,
      number: r.number,
      editionSize: r.variant.editionSize,
      state: r.state,
      buyerName: order?.buyerName ?? null,
      // Cart rows denormalise buyerEmail onto the EditionNumber; prefer the
      // resolved order's email, fall back to the row snapshot.
      buyerEmail: order?.buyerEmail ?? r.buyerEmail ?? null,
      orderId: order?.id ?? null,
      date: (r.soldAt ?? r.reservedAt)?.toISOString() ?? null,
      mirroredInTps: Boolean(order?.tpsEditionMirroredAt),
    }
  })

  return { ok: true, sales }
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
      editionNumber: { include: { variant: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          artwork: { select: { title: true, slug: true, imageUrl: true } },
          artistUser: { select: { name: true, lastName: true } },
          editionNumbers: {
            orderBy: { number: 'asc' },
            select: {
              number: true,
              state: true,
              variant: {
                select: {
                  name: true,
                  paperId: true,
                  printTypeId: true,
                  widthCm: true,
                  heightCm: true,
                  borderCm: true,
                  editionSize: true,
                },
              },
            },
          },
        },
      },
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

  // Limited-edition fulfillment block — the copy-ready line the admin
  // pastes into TPS's Sell-as-Print manual order, plus the number to tick
  // as sold. Null for open editions.
  let edition: AdminOrderDetail['edition'] = null
  if (r.editionNumber) {
    const en = r.editionNumber
    const v = en.variant
    const paperLabel = TPS_PAPERS.find((p) => p.id === v.paperId)?.label ?? v.paperId
    const printTypeLabel =
      TPS_PRINT_TYPES.find((t) => t.id === v.printTypeId)?.label ?? v.printTypeId
    const label = `${v.name} #${en.number}/${v.editionSize}`
    const tpsSku =
      `${printTypeLabel} · ${paperLabel} · ${v.heightCm}×${v.widthCm}cm` +
      ` + ${v.borderCm}cm border · Print Only · ${en.number}/${v.editionSize}`
    edition = {
      variantName: v.name,
      number: en.number,
      editionSize: v.editionSize,
      state: en.state,
      label,
      tpsSku,
      mirroredInTpsAt: r.tpsEditionMirroredAt?.toISOString() ?? null,
    }
  }

  // Per-line items for cart orders. Empty for legacy single-print orders
  // (items.length === 0), in which case the UI uses the header fields. Each
  // item's specsSummary is derived display-only from its own printConfig +
  // the live catalog, falling back to an empty array on any failure (mirrors
  // the header `specs` behaviour above).
  const items: AdminOrderItem[] = await Promise.all(
    r.items.map(async (it) => {
      let specsSummary: SpecsSummary = []
      try {
        const catalog = await loadProviderCatalog('printspace', {
          imageWidthPx: 1000,
          imageHeightPx: 1000,
        })
        specsSummary = summarizeConfig(catalog, it.printConfig as WizardConfig)
      } catch {
        // non-fatal
      }
      // One copy-ready TPS Sell-as-Print line per numbered copy on this line,
      // mirroring the legacy single-print `edition.tpsSku` so the admin gets
      // the same paste-ready string for every limited cart item. Empty for
      // open editions (no edition numbers).
      const tpsSkus = it.editionNumbers.map((en) => {
        const v = en.variant
        const paperLabel = TPS_PAPERS.find((p) => p.id === v.paperId)?.label ?? v.paperId
        const printTypeLabel =
          TPS_PRINT_TYPES.find((t) => t.id === v.printTypeId)?.label ?? v.printTypeId
        return (
          `${printTypeLabel} · ${paperLabel} · ${v.heightCm}×${v.widthCm}cm` +
          ` + ${v.borderCm}cm border · Print Only · ${en.number}/${v.editionSize}`
        )
      })
      return {
        id: it.id,
        artworkTitle: it.artwork.title ?? it.artwork.slug ?? '(untitled)',
        artworkSlug: it.artwork.slug,
        artistName: `${it.artistUser.name} ${it.artistUser.lastName}`.trim(),
        quantity: it.quantity,
        productionCents: it.productionCents,
        artistCents: it.artistCents,
        galleryCents: it.galleryCents,
        transferId: it.transferId,
        transferStatus: it.transferStatus,
        paidOutAt: it.paidOutAt?.toISOString() ?? null,
        specsSummary,
        editionLabels: it.editionNumbers.map((en) => `${en.number}/${en.variant.editionSize}`),
        tpsSkus,
      }
    }),
  )
  const isCart = items.length > 0

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
    itemCount: items.length,
    shippingAddress: r.shippingAddress,
    printConfig: r.printConfig,
    productionCents: r.productionCents,
    productionShippingCents: r.productionShippingCents,
    galleryCents: r.galleryCents,
    customerVatCents: r.customerVatCents,
    isCart,
    items,
    specs,
    assetUrl: r.artwork.originalImageUrl ?? r.artwork.imageUrl ?? null,
    thumbnailUrl: r.artwork.imageUrl ?? r.artwork.originalImageUrl ?? null,
    edition,
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
      _count: { select: { items: true } },
    },
  })
  if (!order) return { ok: false, error: 'Order not found.' }

  // Defense-in-depth: the header payout pays the header rollup artistCents
  // (Σ all artists' cuts) to the header artistUserId (the FIRST item's artist
  // only) for a cart order — a cross-artist mispayment. The UI hides this
  // block for carts, but this server action is directly invocable. Cart
  // orders MUST be paid per line via releaseItemPayout.
  if (order._count.items > 0) {
    return { ok: false, error: 'Cart order — pay each item via the per-item payout.' }
  }

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

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: { _count: { select: { items: true } } },
  })
  if (!order) return { ok: false, error: 'Order not found.' }

  // Defense-in-depth: same cross-artist mispayment risk as releasePayout —
  // the header amount/artist are deprecated rollups for carts. Record manual
  // payouts per line via markItemPaidManually instead.
  if (order._count.items > 0) {
    return { ok: false, error: 'Cart order — record each item via the per-item payout.' }
  }

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
 * Per-item version of `releasePayout` for cart orders. Each PrintOrderItem
 * is a separate artist's share, so a mixed-artist cart is paid out line by
 * line and an order can be partly paid out.
 *
 * Mirrors `releasePayout`'s guards exactly, sourced from the parent order
 * (payment succeeded + fulfillment Complete) and the line item (no existing
 * transferId, artist onboarded, amount > 0). On success it stamps the
 * PrintOrderItem (not the header) and logs a 'payout_released' event on the
 * parent order so the timeline shows each artist being paid.
 */
export async function releaseItemPayout(
  orderItemId: string,
): Promise<{ ok: true; transferId: string } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const item = await prisma.printOrderItem.findUnique({
    where: { id: orderItemId },
    include: {
      order: {
        select: {
          id: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          paymentIntentId: true,
          currency: true,
        },
      },
      artistUser: {
        select: { stripeAccountId: true, stripeOnboardingComplete: true, name: true, email: true },
      },
      artwork: { select: { title: true, slug: true } },
    },
  })
  if (!item) return { ok: false, error: 'Order item not found.' }

  const order = item.order
  // Same payout preconditions as the header path — the gate lives on the
  // parent order (the buyer paid once, the order was delivered once).
  if (order.paymentStatus !== 'succeeded') {
    return { ok: false, error: `Payment not succeeded (status: ${order.paymentStatus}).` }
  }
  if (order.fulfillmentStatus !== STAGE_COMPLETE) {
    return {
      ok: false,
      error: `Order is "${order.fulfillmentStatus ?? 'pending'}"; wait until Complete before releasing.`,
    }
  }
  if (item.transferId) {
    return { ok: false, error: `Item payout already released (${item.transferId}).` }
  }
  const artistAccountId = item.artistUser.stripeAccountId
  if (!artistAccountId || !item.artistUser.stripeOnboardingComplete) {
    return { ok: false, error: 'Artist has not completed Stripe Connect onboarding.' }
  }
  if (item.artistCents <= 0) {
    return { ok: false, error: 'Artist amount is zero.' }
  }

  const artworkTitle = item.artwork.title ?? item.artwork.slug ?? '(untitled)'

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: item.artistCents,
        currency: order.currency,
        destination: artistAccountId,
        transfer_group: order.paymentIntentId,
        description: `Artist payout for order ${order.id} item ${item.id}`,
        metadata: {
          orderId: order.id,
          orderItemId: item.id,
          paymentIntentId: order.paymentIntentId,
        },
      },
      // Per-item idempotency key so paying one line never collides with
      // another line (or the legacy header payout key).
      { idempotencyKey: `payout:item:${item.id}` },
    )

    await prisma.printOrderItem.update({
      where: { id: item.id },
      data: {
        transferId: transfer.id,
        transferStatus: 'paid',
        paidOutAt: new Date(),
      },
    })

    await logOrderEvent({
      orderId: order.id,
      kind: 'payout_released',
      actor: `admin:${guard.session.user.id}`,
      message: `Payout released to ${`${item.artistUser.name ?? ''}`.trim() || 'artist'} for "${artworkTitle}"`,
      payload: {
        orderItemId: item.id,
        transferId: transfer.id,
        amountCents: item.artistCents,
        currency: order.currency,
        artworkTitle,
      },
    })

    if (item.artistUser.email) {
      const emailRes = await sendArtistPayoutEmail({
        to: item.artistUser.email,
        artistFirstName: item.artistUser.name ?? '',
        artworkTitle,
        amountCents: item.artistCents,
        currency: order.currency,
        transferId: transfer.id,
      })
      await logOrderEvent({
        orderId: order.id,
        kind: emailRes.ok ? 'email_sent' : 'email_failed',
        actor: 'system',
        message: 'artist_payout',
        payload: emailRes.ok
          ? { to: item.artistUser.email, orderItemId: item.id, resendId: emailRes.id }
          : { to: item.artistUser.email, orderItemId: item.id, error: emailRes.error },
      })
    }

    return { ok: true, transferId: transfer.id }
  } catch (err) {
    console.error(`[releaseItemPayout] item=${item.id} failed:`, err)
    captureError(err, {
      flow: 'admin',
      stage: 'release-item-payout',
      extra: {
        orderId: order.id,
        orderItemId: item.id,
        artistUserId: item.artistUserId,
        artistAccountId,
        amountCents: item.artistCents,
      },
      level: 'error',
      fingerprint: ['admin:release-item-payout-failed'],
    })
    return { ok: false, error: 'Stripe transfer failed. Check server logs.' }
  }
}

/**
 * Per-item version of `markPaidManually` for cart orders. Records an
 * off-Stripe payout for a single line (Wise, SEPA, etc.): stamps the
 * PrintOrderItem's `paidOutAt` + `transferStatus = 'paid_manual'`, no
 * Stripe call. transferId stays null. Same gating as `releaseItemPayout`.
 */
export async function markItemPaidManually(
  orderItemId: string,
  opts: { method: string; reference?: string; note?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const method = (opts.method ?? '').trim()
  if (!method) return { ok: false, error: 'A payment method is required (e.g. SEPA, Wise).' }

  const item = await prisma.printOrderItem.findUnique({
    where: { id: orderItemId },
    include: {
      order: { select: { id: true, paymentStatus: true, fulfillmentStatus: true, currency: true } },
      artwork: { select: { title: true, slug: true } },
    },
  })
  if (!item) return { ok: false, error: 'Order item not found.' }

  const order = item.order
  if (order.paymentStatus !== 'succeeded') {
    return { ok: false, error: `Payment not succeeded (status: ${order.paymentStatus}).` }
  }
  if (order.fulfillmentStatus !== STAGE_COMPLETE) {
    return {
      ok: false,
      error: `Order is "${order.fulfillmentStatus ?? 'pending'}"; wait until Complete before recording a payout.`,
    }
  }
  if (item.paidOutAt) {
    return {
      ok: false,
      error: item.transferId
        ? `Already paid via Stripe (${item.transferId}).`
        : 'Already marked paid manually.',
    }
  }
  if (item.artistCents <= 0) {
    return { ok: false, error: 'Artist amount is zero.' }
  }

  await prisma.printOrderItem.update({
    where: { id: item.id },
    data: {
      transferStatus: 'paid_manual',
      paidOutAt: new Date(),
    },
  })

  const artworkTitle = item.artwork.title ?? item.artwork.slug ?? '(untitled)'
  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: `Marked item paid manually via ${method} for "${artworkTitle}"`,
    payload: {
      orderItemId: item.id,
      method,
      reference: opts.reference?.trim() || undefined,
      note: opts.note?.trim() || undefined,
      amountCents: item.artistCents,
      currency: order.currency,
      artworkTitle,
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

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      // Cart line items carry the per-artist payouts (PrintOrderItem.transferId
      // / transferStatus). A whole-order refund must claw back any already-sent
      // Stripe transfers so the gallery isn't left covering the artists' cuts.
      // Empty for legacy single-print orders (items.length === 0), whose payout
      // lives on the header and is intentionally NOT auto-reversed here.
      items: {
        select: {
          id: true,
          transferId: true,
          transferStatus: true,
          artistCents: true,
          artistUserId: true,
        },
      },
    },
  })
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
    // 1) Make the buyer whole FIRST — one PaymentIntent covers the whole cart.
    // Doing this before any transfer reversal guarantees the buyer is refunded
    // even if a later clawback fails (reversals are non-fatal, see below).
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

    // 2) Reverse cart line transfers. For a CART order (items.length > 0) each
    // line was paid to its artist independently, so we claw back each
    // already-sent Stripe transfer here. Single-print orders skip this block
    // entirely (their header transfer is left as-is — see payoutAlreadyReleased
    // below) preserving the legacy behaviour exactly.
    const reversedItemIds: string[] = []
    const manualClawbackItemIds: string[] = []
    const reversalFailures: { orderItemId: string; transferId: string; error: string }[] = []

    for (const item of order.items) {
      // 'paid' = a real Stripe transfer was sent → reverse it on Stripe.
      if (item.transferStatus === 'paid' && item.transferId) {
        try {
          await stripe.transfers.createReversal(
            item.transferId,
            {
              metadata: {
                orderId: order.id,
                orderItemId: item.id,
                adminReason: reason.slice(0, 500),
              },
            },
            // Per-item idempotency so retrying a refund never double-reverses
            // a line (or collides with another line's reversal).
            { idempotencyKey: `reversal:${item.id}` },
          )
          await prisma.printOrderItem.update({
            where: { id: item.id },
            data: { transferStatus: 'reversed' },
          })
          reversedItemIds.push(item.id)
        } catch (reversalErr) {
          // Non-fatal: capture, record, and keep going. The buyer refund (above)
          // and the edition release / refunded state (below) MUST still complete
          // even if a single clawback fails — the admin reconciles the rest.
          const errMsg = reversalErr instanceof Error ? reversalErr.message : String(reversalErr)
          reversalFailures.push({
            orderItemId: item.id,
            transferId: item.transferId,
            error: errMsg,
          })
          console.error(
            `[refundOrder] reversal failed order=${order.id} item=${item.id} transfer=${item.transferId}:`,
            reversalErr,
          )
          captureError(reversalErr, {
            flow: 'admin',
            stage: 'refund-order-reverse-transfer',
            extra: {
              orderId: order.id,
              orderItemId: item.id,
              transferId: item.transferId,
              artistUserId: item.artistUserId,
              amountCents: item.artistCents,
            },
            level: 'error',
            fingerprint: ['admin:refund-reversal-failed'],
          })
        }
      } else if (item.transferStatus === 'paid_manual') {
        // Off-Stripe payout — there's nothing for Stripe to reverse. Flag it so
        // the admin claws the money back by hand; we don't touch the item here.
        manualClawbackItemIds.push(item.id)
        await logOrderEvent({
          orderId: order.id,
          kind: 'admin_action',
          actor: `admin:${adminId}`,
          message: 'Manual clawback required (off-Stripe artist payout)',
          payload: {
            orderItemId: item.id,
            artistUserId: item.artistUserId,
            amountCents: item.artistCents,
            reason,
          },
        })
      }
    }

    // 3) Mark refunded + release edition numbers (unchanged for both shapes).
    await prisma.printOrder.update({
      where: { id: order.id },
      data: { paymentStatus: 'refunded' },
    })

    // Return the edition number to the pool on refund (default policy:
    // release + audit). Idempotent; no-op for open editions.
    await releaseEditionNumberForPaymentIntent(order.paymentIntentId, { allowSold: true })

    await logOrderEvent({
      orderId: order.id,
      kind: 'admin_action',
      actor: `admin:${adminId}`,
      message: 'Refund issued',
      payload: {
        reason,
        amountCents: order.totalCents,
        // Legacy single-print header payout flag — unchanged. For carts the
        // header transfer is deprecated, so this is effectively about the
        // single-print path; the cart clawback detail lives in the fields below.
        payoutAlreadyReleased: !!order.transferId,
        // Exactly what was clawed back (cart orders): Stripe reversals applied,
        // off-Stripe lines needing a by-hand clawback, and any reversal failures.
        reversedItemIds,
        manualClawbackItemIds,
        ...(reversalFailures.length > 0 ? { reversalFailures } : {}),
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

  // Free any held edition number before the order row goes away (the FK
  // would null out on delete, but we also want the state reset).
  await releaseEditionNumberForPaymentIntent(order.paymentIntentId, { allowSold: true })

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

  // Confirm the held edition number as sold at capture (limited editions
  // only; a no-op for open orders). Our ledger is authoritative — the
  // admin still mirrors this number as sold in TPS by hand.
  await markEditionNumberSold(order.paymentIntentId)
  // Resolve the order's edition number for the timeline event. Single-print
  // orders bind via the deprecated EditionNumber.orderId; cart orders bind
  // via EditionNumber.orderItem.orderId (orderId stays null). Match either
  // so the 'edition_sold' event fires for both paths.
  const soldNumber = await prisma.editionNumber.findFirst({
    where: { OR: [{ orderId: order.id }, { orderItem: { orderId: order.id } }] },
    select: { number: true, variant: { select: { name: true, editionSize: true } } },
  })
  if (soldNumber) {
    await logOrderEvent({
      orderId: order.id,
      kind: 'edition_sold',
      actor: `admin:${guard.session.user.id}`,
      message: `Edition ${soldNumber.variant.name} ${soldNumber.number}/${soldNumber.variant.editionSize} confirmed sold`,
      payload: { number: soldNumber.number, editionSize: soldNumber.variant.editionSize },
    })
  }

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
 * Admin CTA: the admin has manually mirrored this order's edition number
 * as "sold" in TPS's Manage Edition modal. Our ledger stays the source of
 * truth; this just records that the by-hand TPS step is done so it can't
 * be forgotten.
 */
export async function markEditionMirroredInTps(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  // Single-print orders bind via the deprecated EditionNumber.orderId; cart
  // orders bind via EditionNumber.orderItem.orderId (orderId stays null).
  // Match either so the mirror step works for both paths.
  const en = await prisma.editionNumber.findFirst({
    where: { OR: [{ orderId }, { orderItem: { orderId } }] },
    select: { number: true, variant: { select: { name: true, editionSize: true } } },
  })
  if (!en) return { ok: false, error: 'This order has no edition number to mirror.' }

  await prisma.printOrder.update({
    where: { id: orderId },
    data: { tpsEditionMirroredAt: new Date() },
  })
  await logOrderEvent({
    orderId,
    kind: 'edition_mirrored',
    actor: `admin:${guard.session.user.id}`,
    message: `Edition ${en.variant.name} ${en.number}/${en.variant.editionSize} mirrored as sold in TPS`,
    payload: { number: en.number, editionSize: en.variant.editionSize },
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

  // Return the edition number to the pool. The print was never produced
  // on a reject, so even a captured (sold) number is freed. Idempotent
  // and a no-op for open editions.
  await releaseEditionNumberForPaymentIntent(order.paymentIntentId, { allowSold: true })

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
