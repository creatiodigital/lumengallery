'use server'

import { requireAdminAction } from '@/lib/authUtils'
import {
  formatDualDimensions,
  summarizeConfig,
  type SpecsSummary,
  type WizardConfig,
} from '@/lib/print-providers'
import { TPS_PAPERS, TPS_PRINT_TYPES } from '@/lib/print-providers/printspace'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { sendAdminOrderCancelledAlert } from '@/lib/emails/adminOrderCancelled'
import { sendArtistPayoutEmail } from '@/lib/emails/artistPayout'
import { sendInvoiceEmail } from '@/lib/emails/invoice'
import { sendOrderCancelledEmail } from '@/lib/emails/orderCancelled'
import { sendOrderDeliveredEmail } from '@/lib/emails/orderDelivered'
import { sendOrderInProductionEmail } from '@/lib/emails/orderInProduction'
import { sendOrderShippedEmail } from '@/lib/emails/orderShipped'
import { sendRefundIssuedEmail } from '@/lib/emails/refundIssued'
import { markEditionNumberSold } from '@/lib/editions/reserveEditionNumber'
import { OFF_PLATFORM_KINDS, type OffPlatformKind } from '@/lib/orders/offPlatformKinds'
import { REORDER_REASONS, type ReorderReason } from '@/lib/orders/reorderReasons'
import { computeOrderPayout } from '@/lib/orders/orderPayout'
import { devCleanupAllowed } from '@/lib/admin/resetTestData'
import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
import { captureError } from '@/lib/observability/captureError'
import { EMAIL_BRAND } from '@/lib/emails/brand'
import { logOrderEvent, type OrderEventActor } from '@/lib/orders/logOrderEvent'
import type { InvoiceLine } from '@/lib/invoices/buildInvoiceLines'
import type {
  BuyerSnapshot,
  SellerSnapshot,
  TotalsSnapshot,
} from '@/lib/invoices/buildInvoiceSnapshots'
import { prepareInvoiceIssue } from '@/lib/invoices/prepareInvoiceIssue'
import { getOrIssueInvoice } from '@/lib/invoices/getOrIssueInvoice'
import { renderInvoicePdf } from '@/lib/invoices/renderInvoicePdf'
import { buildInvoiceKey, deletePrivateR2Key, uploadPrivateToR2, r2ObjectExists } from '@/lib/r2'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'
import { formatOrderRef } from '@/lib/orders/orderRef'

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
  /** Artist-payout rollup that is cart-aware (every line paid) AND legacy-aware
   *  (header paidOutAt). Drives the "Artist paid" bucket + payout column so a
   *  fully-paid cart order doesn't get stranded in "Delivered". */
  payoutComplete: boolean
  payoutAt: string | null
  payoutManual: boolean
  latestEvent: { kind: string; message: string | null; at: string } | null
  /** Number of PrintOrderItem line rows. 0 = legacy single-print order
   *  (data on the header), > 0 = cart order. */
  itemCount: number
  /** One entry per purchased line: what it is, and which numbered copies it
   *  owns. Lets the orders LIST say "Landscape and River — 40x50 #1/100"
   *  instead of "1 print", so an admin can find the order holding a given
   *  edition number without opening every row. */
  itemSummaries: {
    artworkTitle: string | null
    editionName: string | null
    editionLabels: string[]
    quantity: number
  }[]
  /** Replacement-reprint marker. > 0 = this order has been re-ordered (see
   *  reorderReason); drives the permanent "⟳ Replacement" badge. */
  reorderCount: number
  reorderReason: string | null
}

// Kept under the historical local name; the implementation is the shared
// guard in authUtils (one admin gate for every server-action file).
async function requireAdminSession() {
  return requireAdminAction()
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
      items: {
        select: {
          paidOutAt: true,
          transferStatus: true,
          quantity: true,
          artwork: { select: { title: true, slug: true } },
          // What this line actually IS, for the list row. Without it a cart
          // order reads only as "1 print", so an admin told to "cancel the
          // order that owns copy 1" has no way to find which one that is.
          editionNumbers: {
            select: { number: true, variant: { select: { name: true, editionSize: true } } },
            orderBy: { number: 'asc' },
          },
        },
      },
      _count: { select: { items: true } },
    },
  })

  const orders: AdminOrderRow[] = rows.map((r) => {
    const payout = computeOrderPayout(r.items, r.paidOutAt, r.transferStatus)
    return {
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
      payoutComplete: payout.complete,
      payoutAt: payout.at?.toISOString() ?? null,
      payoutManual: payout.manual,
      latestEvent: r.events[0]
        ? { kind: r.events[0].kind, message: r.events[0].message, at: r.events[0].at.toISOString() }
        : null,
      itemCount: r._count.items,
      itemSummaries: r.items.map((it) => ({
        artworkTitle: it.artwork?.title ?? it.artwork?.slug ?? null,
        editionName: it.editionNumbers[0]?.variant.name ?? null,
        editionLabels: it.editionNumbers.map((en) => `${en.number}/${en.variant.editionSize}`),
        quantity: it.quantity,
      })),
      reorderCount: r.reorderCount,
      reorderReason: r.reorderReason,
    }
  })

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
  /** Limited-edition variant display name (e.g. "Medium"); null for open
   *  editions. Sourced from the bound edition numbers' shared variant. */
  editionName: string | null
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
  /** Replacement-reprint detail for the header badge + history. */
  reorderNote: string | null
  reorderedAt: string | null
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
  /** The first invoice issued for this order (type='invoice'), or null if none yet. */
  invoice: { id: string; number: string } | null
  /** The credit note for this order, or null if none yet. */
  creditNote: { id: string; number: string } | null
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
  // identical to the prior behavior so nothing single-print regresses.
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
  artistName: string
  variantName: string
  number: number
  editionSize: number
  state: string // 'reserved' | 'sold'
  buyerName: string | null
  buyerEmail: string | null
  orderId: string | null
  date: string | null
  mirroredInTps: boolean
  /** Set on order-less copies consumed by hand from the ledger
   *  ('gift' | 'artist_copy' | 'test'), with the admin's note. */
  offPlatformKind: string | null
  offPlatformNote: string | null
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
      variant: {
        include: {
          artwork: {
            select: {
              title: true,
              slug: true,
              author: true,
              user: { select: { name: true, lastName: true } },
            },
          },
        },
      },
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
      // Artist display: the per-work `author` override if set, else the
      // owning user's name (same convention as the public grid).
      artistName:
        r.variant.artwork.author?.trim() ||
        [r.variant.artwork.user.name, r.variant.artwork.user.lastName]
          .filter(Boolean)
          .join(' ')
          .trim(),
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
      offPlatformKind: r.offPlatformKind,
      offPlatformNote: r.offPlatformNote,
    }
  })

  return { ok: true, sales }
}

export type GiftableVariantRow = {
  variantId: string
  artworkTitle: string
  artistName: string
  variantName: string
  editionSize: number
  /** The artist's current price for this variant (cents) — becomes the
   *  artist fee owed when the copy is a gallery GIFT. */
  artistPriceCents: number
  /** Ascending list of numbers still free to consume. */
  availableNumbers: number[]
}

/**
 * Published limited variants with at least one available number — the
 * targets an off-platform copy (gift / artist copy / test print) can be
 * issued against from the admin ledger.
 */
export async function listGiftableVariants(): Promise<
  { ok: true; variants: GiftableVariantRow[] } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  // Published variants have materialised 1..N numbers; unpublished ones have
  // no slots to consume. Deliberately NOT filtered on `blocked`: a paused
  // variant can still gift a copy (the pause only hides it from buyers).
  const variants = await prisma.limitedVariant.findMany({
    where: { published: true, editionNumbers: { some: { state: 'available' } } },
    include: {
      artwork: {
        select: { title: true, author: true, user: { select: { name: true, lastName: true } } },
      },
      editionNumbers: {
        where: { state: 'available' },
        select: { number: true },
        orderBy: { number: 'asc' },
      },
    },
    orderBy: { artwork: { title: 'asc' } },
  })

  return {
    ok: true,
    variants: variants.map((v) => ({
      variantId: v.id,
      artworkTitle: v.artwork.title ?? '(untitled)',
      artistName:
        v.artwork.author?.trim() ||
        [v.artwork.user.name, v.artwork.user.lastName].filter(Boolean).join(' ').trim(),
      variantName: v.name,
      editionSize: v.editionSize,
      artistPriceCents: v.priceCents ?? 0,
      availableNumbers: v.editionNumbers.map((n) => n.number),
    })),
  }
}

/**
 * Create an OFF-PLATFORM order — a gallery gift, artist-retained copy, or
 * test print. No Stripe, no PrintOrder, no invoice/payout/emails: the record
 * is an OffPlatformOrder carrying the recipient + the manual TPS fulfillment
 * stages, and the consumed edition number flips straight to `sold` (linked
 * via offPlatformOrderId) so it can never be sold to a buyer and the public
 * "n of N" counter stays truthful. Reversed via `cancelOffPlatformOrder`.
 */
export type OffPlatformRecipientAddress = {
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
  phone?: string
}

export async function createOffPlatformOrder(input: {
  variantId: string
  number: number
  kind: string
  recipientName: string
  address: OffPlatformRecipientAddress
  note?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const kind = (input.kind ?? '').trim()
  if (!OFF_PLATFORM_KINDS.includes(kind as OffPlatformKind)) {
    return { ok: false, error: 'A valid copy kind is required.' }
  }
  const recipientName = (input.recipientName ?? '').trim().slice(0, 200)
  if (!recipientName) return { ok: false, error: 'A recipient name is required.' }

  // Full shipping address — the admin copies it into the TPS portal, so the
  // shippable minimum is required here (line1, city, postal code, country).
  const clean = (s: string | undefined, max: number) => (s ?? '').trim().slice(0, max)
  const address: OffPlatformRecipientAddress = {
    line1: clean(input.address?.line1, 200),
    line2: clean(input.address?.line2, 200) || undefined,
    city: clean(input.address?.city, 100),
    state: clean(input.address?.state, 100) || undefined,
    postalCode: clean(input.address?.postalCode, 20),
    country: clean(input.address?.country, 100),
    phone: clean(input.address?.phone, 40) || undefined,
  }
  if (!address.line1 || !address.city || !address.postalCode || !address.country) {
    return {
      ok: false,
      error: 'Street, city, postal code and country are required (they go to TPS).',
    }
  }
  const recipientCountry = address.country
  const note = (input.note ?? '').trim().slice(0, 500) || null

  const variant = await prisma.limitedVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, published: true, priceCents: true },
  })
  if (!variant) return { ok: false, error: 'Variant not found.' }
  if (!variant.published) {
    return { ok: false, error: 'This variant has no materialised edition numbers yet.' }
  }

  // Kind decides the artist fee: a gallery GIFT owes the artist their cut
  // (price snapshot at creation — immune to later escalation); artist
  // copies and test prints owe nothing. Never a gallery cut.
  const artistCents = kind === 'gift' ? (variant.priceCents ?? 0) : 0

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.offPlatformOrder.create({
        data: {
          kind,
          recipientName,
          recipientCountry,
          recipientAddress: address,
          note,
          artistCents,
        },
        select: { id: true },
      })
      // Atomic take: only flips if the slot is still available, so a
      // concurrent buyer reservation can never be overwritten.
      const taken = await tx.editionNumber.updateMany({
        where: { variantId: input.variantId, number: input.number, state: 'available' },
        data: {
          state: 'sold',
          soldAt: new Date(),
          offPlatformKind: kind,
          offPlatformNote: note,
          offPlatformOrderId: created.id,
        },
      })
      if (taken.count === 0) {
        throw new Error(
          `Number ${input.number} is not available (already reserved, sold, or nonexistent).`,
        )
      }
      return created
    })
    return { ok: true, id: order.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export type OffPlatformOrderRow = {
  id: string
  kind: string
  recipientName: string
  recipientCountry: string | null
  recipientAddress: OffPlatformRecipientAddress | null
  note: string | null
  fulfillmentStatus: string | null
  trackingUrl: string | null
  createdAt: string
  /** Artist cut owed for this copy (kind 'gift' only; 0 for artist copies
   *  and test prints). Snapshot at creation. */
  artistCents: number
  artistPaidAt: string | null
  copies: {
    artworkTitle: string
    artistName: string
    variantName: string
    number: number
    editionSize: number
  }[]
}

/** All off-platform orders (gifts / artist copies / test prints), newest first. */
export async function listOffPlatformOrders(): Promise<
  { ok: true; orders: OffPlatformOrderRow[] } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const rows = await prisma.offPlatformOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      editionNumbers: {
        select: {
          number: true,
          variant: {
            select: {
              name: true,
              editionSize: true,
              artwork: {
                select: {
                  title: true,
                  author: true,
                  user: { select: { name: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { number: 'asc' },
      },
    },
  })

  return {
    ok: true,
    orders: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      recipientName: r.recipientName,
      recipientCountry: r.recipientCountry,
      recipientAddress: (r.recipientAddress as OffPlatformRecipientAddress | null) ?? null,
      note: r.note,
      fulfillmentStatus: r.fulfillmentStatus,
      trackingUrl: r.trackingUrl,
      createdAt: r.createdAt.toISOString(),
      artistCents: r.artistCents,
      artistPaidAt: r.artistPaidAt?.toISOString() ?? null,
      copies: r.editionNumbers.map((n) => ({
        artworkTitle: n.variant.artwork.title ?? '(untitled)',
        artistName:
          n.variant.artwork.author?.trim() ||
          [n.variant.artwork.user.name, n.variant.artwork.user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim(),
        variantName: n.variant.name,
        number: n.number,
        editionSize: n.variant.editionSize,
      })),
    })),
  }
}

/**
 * Tick the artist fee of a gift order as paid (manual bank transfer, same
 * discipline as regular payouts). Only meaningful when the order carries a
 * fee (kind 'gift') and isn't cancelled.
 */
export async function markOffPlatformArtistPaid(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.offPlatformOrder.findUnique({
    where: { id },
    select: { id: true, artistCents: true, artistPaidAt: true, fulfillmentStatus: true },
  })
  if (!order) return { ok: false, error: 'Off-platform order not found.' }
  if (order.artistCents <= 0) return { ok: false, error: 'This order carries no artist fee.' }
  if (order.artistPaidAt) return { ok: false, error: 'Already marked paid.' }
  if (order.fulfillmentStatus === STAGE_CANCELLED) {
    return { ok: false, error: 'This order is cancelled — nothing to pay.' }
  }

  await prisma.offPlatformOrder.update({ where: { id }, data: { artistPaidAt: new Date() } })
  return { ok: true }
}

/**
 * Hard-delete a CANCELLED gift order so failed experiments don't clutter the
 * list. Only cancelled rows qualify (their numbers were already released on
 * cancel, and no money ever touched an off-platform order).
 */
export async function deleteCancelledOffPlatformOrder(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.offPlatformOrder.findUnique({
    where: { id },
    select: { id: true, fulfillmentStatus: true },
  })
  if (!order) return { ok: false, error: 'Off-platform order not found.' }
  if (order.fulfillmentStatus !== STAGE_CANCELLED) {
    return { ok: false, error: 'Only cancelled gift orders can be deleted — cancel it first.' }
  }

  await prisma.offPlatformOrder.delete({ where: { id } })
  return { ok: true }
}

/**
 * Advance an off-platform order along the SAME manual TPS stages as a
 * regular order (pending → Placed → Started → Shipped → Complete), with the
 * tracking URL captured at Shipped. Backward moves are allowed (fix a
 * misclick) — there's no money/email machinery attached to the stages here.
 */
export async function advanceOffPlatformOrder(
  id: string,
  newStage: string | null,
  opts: { trackingUrl?: string } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const validStages = [STAGE_PENDING, STAGE_PLACED, STAGE_STARTED, STAGE_SHIPPED, STAGE_COMPLETE]
  if (!validStages.includes(newStage)) {
    return { ok: false, error: 'Invalid stage.' }
  }

  const order = await prisma.offPlatformOrder.findUnique({
    where: { id },
    select: { id: true, fulfillmentStatus: true },
  })
  if (!order) return { ok: false, error: 'Off-platform order not found.' }
  if (order.fulfillmentStatus === STAGE_CANCELLED) {
    return { ok: false, error: 'This order is cancelled — no further actions.' }
  }

  const trackingUrl = (opts.trackingUrl ?? '').trim() || null
  await prisma.offPlatformOrder.update({
    where: { id },
    data: {
      fulfillmentStatus: newStage,
      ...(trackingUrl !== null ? { trackingUrl } : {}),
      ...(newStage === STAGE_SHIPPED ? { shippedAt: new Date() } : {}),
    },
  })
  return { ok: true }
}

/**
 * Cancel an off-platform order and RELEASE its edition number(s) back to
 * available — mirror of the refund-releases-number rule on paid orders. Only
 * sensible before the print physically exists; the confirm UI carries that
 * warning, the server allows any non-cancelled stage (admin's judgement).
 */
export async function cancelOffPlatformOrder(
  id: string,
): Promise<{ ok: true; numberReleased: boolean } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.offPlatformOrder.findUnique({
    where: { id },
    select: { id: true, fulfillmentStatus: true },
  })
  if (!order) return { ok: false, error: 'Off-platform order not found.' }
  if (order.fulfillmentStatus === STAGE_CANCELLED) {
    return { ok: false, error: 'Already cancelled.' }
  }

  // Cancelling is always allowed — the row must be able to record that the gift
  // was called off. Returning the NUMBER to the pool is not: from production
  // start onward a physical print carrying that number exists, so releasing it
  // would let the same copy be sold to a buyer as well, two prints numbered
  // e.g. 29/50. Same cutoff buyer orders use (`stageAllowsEditionRelease`).
  const releaseNumber = stageAllowsEditionRelease(order.fulfillmentStatus)

  try {
    await prisma.$transaction([
      ...(releaseNumber
        ? [
            prisma.editionNumber.updateMany({
              where: { offPlatformOrderId: id },
              data: {
                state: 'available',
                soldAt: null,
                offPlatformKind: null,
                offPlatformNote: null,
                offPlatformOrderId: null,
              },
            }),
          ]
        : []),
      prisma.offPlatformOrder.update({
        where: { id },
        data: { fulfillmentStatus: STAGE_CANCELLED },
      }),
    ])
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: 'cancel-off-platform-order',
      extra: { id },
      level: 'error',
      fingerprint: ['admin:cancel-off-platform-order-failed'],
    })
    return {
      ok: false,
      error: `Cancel failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
  return { ok: true, numberReleased: releaseNumber }
}

/**
 * RELEASE a single ORPHANED edition number from the ledger — a reserved/sold
 * copy no longer attached to any order (abandoned cart holds / abandoned
 * checkouts). Sets it back to `available` and clears its bindings: the row
 * (the numbered slot) stays, so the edition is never gapped — it just drops
 * out of this ledger (which lists reserved/sold) and can sell again.
 *
 * NOTE: we deliberately release rather than hard-delete. Deleting the row
 * removes the slot permanently, so the next sale skips that number (e.g. an
 * edition would start at 3/30 instead of 1/30). Release keeps 1..N intact.
 *
 * Refuses a number still bound to a live order: that would desync the order
 * from its copy. Cancel or refund that order instead — that path releases it.
 */
export async function releaseOrphanedEditionNumber(
  numberId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const row = await prisma.editionNumber.findUnique({
    where: { id: numberId },
    include: {
      order: { select: { id: true } },
      orderItem: { select: { order: { select: { id: true } } } },
    },
  })
  if (!row) return { ok: false, error: 'Edition number not found.' }
  if (row.state === 'available') {
    return { ok: false, error: 'This number is already available — nothing to release.' }
  }

  const boundOrderId = row.order?.id ?? row.orderItem?.order?.id ?? null
  if (boundOrderId) {
    return {
      ok: false,
      error: `This copy is attached to order ${formatOrderRef(boundOrderId)}. Cancel or refund that order instead.`,
    }
  }
  if (row.offPlatformOrderId) {
    return {
      ok: false,
      error:
        'This copy belongs to a gift / artist-copy order. Cancel it from the Gift orders page instead — that releases the number.',
    }
  }

  try {
    // Reserved OR sold orphan → back to available, all bindings cleared. The
    // numbered slot itself is preserved (no gap in the edition).
    await prisma.editionNumber.updateMany({
      where: { id: numberId, state: { in: ['reserved', 'sold'] } },
      data: {
        state: 'available',
        paymentIntentId: null,
        orderId: null,
        orderItemId: null,
        buyerEmail: null,
        reservedAt: null,
        soldAt: null,
        offPlatformKind: null,
        offPlatformNote: null,
        offPlatformOrderId: null,
      },
    })
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: 'release-orphaned-edition-number',
      extra: { numberId },
      level: 'error',
      fingerprint: ['admin:release-orphan-edition-failed'],
    })
    return {
      ok: false,
      error: `Release failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return { ok: true }
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
      invoices: {
        where: { type: { in: ['invoice', 'credit_note'] } },
        select: { id: true, number: true, type: true },
        orderBy: { issuedAt: 'asc' },
      },
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
      `${printTypeLabel} · ${paperLabel} · ${formatDualDimensions(v.widthCm, v.heightCm)}` +
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
  // the header `specs` behavior above).
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
          `${printTypeLabel} · ${paperLabel} · ${formatDualDimensions(v.widthCm, v.heightCm)}` +
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
        // All numbers on a line share one variant, so the first carries the name.
        editionName: it.editionNumbers[0]?.variant.name ?? null,
        editionLabels: it.editionNumbers.map((en) => `${en.number}/${en.variant.editionSize}`),
        tpsSkus,
      }
    }),
  )
  const isCart = items.length > 0

  const payout = computeOrderPayout(r.items, r.paidOutAt, r.transferStatus)

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
    payoutComplete: payout.complete,
    payoutAt: payout.at?.toISOString() ?? null,
    payoutManual: payout.manual,
    latestEvent: r.events[0]
      ? { kind: r.events[0].kind, message: r.events[0].message, at: r.events[0].at.toISOString() }
      : null,
    itemCount: items.length,
    // Same shape the list uses, rebuilt from the already-resolved line items.
    itemSummaries: items.map((it) => ({
      artworkTitle: it.artworkTitle,
      editionName: it.editionName,
      editionLabels: it.editionLabels,
      quantity: it.quantity,
    })),
    reorderCount: r.reorderCount,
    reorderReason: r.reorderReason,
    reorderNote: r.reorderNote,
    reorderedAt: r.reorderedAt?.toISOString() ?? null,
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
    invoice: r.invoices.find((i) => i.type === 'invoice') ?? null,
    creditNote: r.invoices.find((i) => i.type === 'credit_note') ?? null,
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
const STAGE_CANCELLED = 'Cancelled' // order pulled out before delivery: buyer asked to cancel, couldn't fulfill, TPS rejected the file, artist disabled prints, etc.
// Pre-rename value of 'Cancelled' — main wrote 'Rejected' until the AR-130
// rename and the shared dev DB can still hold such rows. Treated as terminal
// everywhere 'Cancelled' is; never written by new code.
const STAGE_REJECTED_LEGACY = 'Rejected'

/**
 * Whether a cancel/refund may return the order's edition number(s) to the
 * pool. From 'Started' onward a physical numbered print exists (or is being
 * made) — releasing then would let e.g. copy 29/50 sell twice, two physical
 * prints with the same number. Before production start the copy was never
 * made, so the number is safe to resell. Mirrors the refund policy:
 * cutoff = production start (see memory/project_capture_tps_money_flow).
 */
const stageAllowsEditionRelease = (stage: string | null) =>
  stage !== STAGE_STARTED && stage !== STAGE_SHIPPED && stage !== STAGE_COMPLETE

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
 * Re-order / replacement reprint — the faulty-goods remedy when the buyer wants a
 * reprint instead of a refund. Resets the SAME order back to step ② "To place at
 * TPS" so the replacement walks the normal pipeline again, WITHOUT re-charging
 * (paymentStatus stays 'succeeded', so capturePayment can't run) and WITHOUT
 * touching the edition number or payout — the same numbered copy is remade.
 * Records the reason + bumps reorderCount for the permanent "⟳ Replacement"
 * badge. The soft cap (warn from the 3rd) is a UI concern; the server allows any
 * count. Spec: docs/superpowers/specs/2026-06-26-reorder-reprint-design.md
 */
export async function reorderForReprint(
  orderId: string,
  opts: { reason: string; note?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard
  const adminId = guard.session.user.id

  const reason = (opts.reason ?? '').trim()
  if (!REORDER_REASONS.includes(reason as ReorderReason)) {
    return { ok: false, error: 'A valid reason is required to re-order.' }
  }
  const note = (opts.note ?? '').trim().slice(0, 500) || null

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true, fulfillmentStatus: true, reorderCount: true },
  })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.paymentStatus === 'refunded' || order.paymentStatus === 'canceled') {
    return { ok: false, error: `Order is ${order.paymentStatus} — no further actions.` }
  }
  if (order.paymentStatus !== 'succeeded') {
    return { ok: false, error: 'Only a captured order can be re-ordered.' }
  }
  // A reprint only makes sense once a print physically exists (produced /
  // shipped / delivered) — not for an order still pending placement at TPS.
  const reprintable = [STAGE_STARTED, STAGE_SHIPPED, STAGE_COMPLETE]
  if (!order.fulfillmentStatus || !reprintable.includes(order.fulfillmentStatus)) {
    return {
      ok: false,
      error: `Re-order is only available once the print has been produced (current: ${order.fulfillmentStatus ?? 'pending placement'}).`,
    }
  }

  // Reset to "To place at TPS" (succeeded + pending) with a fresh shipment; keep
  // the edition number sold and the payout untouched (the sale stands).
  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: STAGE_PENDING,
      trackingUrl: null,
      shippedAt: null,
      reorderReason: reason,
      reorderNote: note,
      reorderedAt: new Date(),
      reorderCount: { increment: 1 },
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'reorder',
    actor: `admin:${adminId}`,
    message: `Replacement reprint (#${order.reorderCount + 1}) — ${reason}${note ? `: ${note}` : ''}`,
    payload: { reason, note, count: order.reorderCount + 1 },
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
    // below) preserving the legacy behavior exactly.
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

    // Return the edition number to the pool on refund — but ONLY while no
    // physical print exists (pre-production). A refunded buyer who keeps a
    // delivered print keeps its number too; releasing it would sell a second
    // physical copy of the same number. Idempotent; no-op for open editions.
    if (stageAllowsEditionRelease(order.fulfillmentStatus)) {
      await releaseEditionNumberForPaymentIntent(order.paymentIntentId, { allowSold: true })
    } else {
      await logOrderEvent({
        orderId: order.id,
        kind: 'admin_action',
        actor: `admin:${adminId}`,
        message: 'Edition number retained (print already produced — not returned to the pool)',
        payload: { fulfillmentStatus: order.fulfillmentStatus },
      })
    }

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
 * Hard-delete an order — DEV/STAGING CLEANUP ONLY, never production.
 *
 * ORDER IS KING: the delete takes everything the order owns with it —
 * its invoices (register rows + R2 PDFs), its event history, and its
 * ledger entries (edition numbers freed back to the pool, regardless of
 * fulfillment stage). In PRODUCTION this action refuses outright: orders
 * are business records (Stripe cross-reference, audit trail, disputes) —
 * 'Cancelled' is the terminal state there, and an invoiced order is
 * corrected via credit note (issued numbers must stay gap-free for the
 * tax authority; Invoice.orderId onDelete: Restrict backs this at the DB).
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

  if (!devCleanupAllowed()) {
    return {
      ok: false,
      error:
        'Deleting orders is disabled in production — cancel the order instead (and issue a credit note if it is invoiced).',
    }
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: { invoices: { select: { id: true, number: true, r2Key: true } } },
  })
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

  // Free the order's ledger entries (edition numbers) before the row goes
  // away (the FK would null out on delete, but we also want the state reset).
  // Unconditional — this is test-data cleanup (production already returned
  // above), so even a Started/sold number goes back to `available`.
  await releaseEditionNumberForPaymentIntent(order.paymentIntentId, { allowSold: true })

  // The order's invoice PDFs go too. Best-effort and outside the tx — an
  // orphaned PDF in the private bucket is harmless and swept by reconcile-r2.
  for (const inv of order.invoices) {
    if (inv.r2Key) {
      try {
        await deletePrivateR2Key(inv.r2Key)
      } catch (err) {
        console.warn(
          '[deleteOrder] invoice PDF delete failed (dev cleanup):',
          err instanceof Error ? err.message : err,
        )
      }
    }
  }

  try {
    await prisma.$transaction([
      // Invoice rows first (Restrict FK). Empty/no-op in production — an
      // invoiced order never reaches this point there.
      prisma.invoice.deleteMany({ where: { orderId } }),
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
/**
 * Step ① of fulfillment: CAPTURE the buyer's payment, WITHOUT placing the order
 * at TPS. Capture-first is the money-safety rule — the gallery must hold the
 * buyer's money before spending its own at TPS (TPS charges at placement with no
 * account billing, so paying TPS before a successful capture risks a hard loss).
 * See docs/superpowers/specs/2026-06-24-capture-place-split-design.md.
 *
 * Leaves `fulfillmentStatus` at STAGE_PENDING (null) — the order then sits in the
 * "To place at TPS" queue until the admin places it and calls `markPlacedAtTps`.
 * On a Stripe capture failure (dead/expired card, fraud block) the order is left
 * untouched and recoverable, and crucially TPS has been paid nothing.
 */
export async function capturePayment(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.paymentStatus === 'refunded' || order.paymentStatus === 'canceled') {
    return { ok: false, error: `Order is ${order.paymentStatus} — no further actions.` }
  }
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
      stage: 'capture-payment',
      extra: { orderId, paymentIntentId: order.paymentIntentId },
      level: 'error',
      fingerprint: ['admin:capture-payment-failed'],
    })
    return {
      ok: false,
      error: `Stripe capture failed: ${err instanceof Error ? err.message : String(err)}. The authorization has expired or been cancelled — the buyer was never charged. Contact them to re-order, or cancel this order. TPS has not been paid.`,
    }
  }

  // Money taken, but NOT placed at TPS — fulfillment stays pending.
  await prisma.printOrder.update({
    where: { id: order.id },
    data: { paymentStatus: 'succeeded' },
  })

  // Confirm the held edition number as sold at capture (money collected =
  // sale final; limited editions only, a no-op for open orders). Our ledger is
  // authoritative — the admin still mirrors this number as sold in TPS by hand.
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
    kind: 'captured',
    actor: `admin:${guard.session.user.id}`,
    message: 'Payment captured (buyer charged)',
    payload: {},
  })

  return { ok: true }
}

/**
 * Step ② of fulfillment: record that the admin has placed + paid the order at
 * TPS. Requires a SUCCEEDED capture first (so it's impossible to place an order
 * the gallery hasn't been paid for), and does no Stripe work — the capture
 * already happened in `capturePayment`. Advances STAGE_PENDING → STAGE_PLACED.
 */
export async function markPlacedAtTps(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.paymentStatus === 'refunded' || order.paymentStatus === 'canceled') {
    return { ok: false, error: `Order is ${order.paymentStatus} — no further actions.` }
  }
  if (order.fulfillmentStatus !== STAGE_PENDING) {
    return {
      ok: false,
      error: `Already advanced past pending (status: ${order.fulfillmentStatus}).`,
    }
  }
  if (order.paymentStatus !== 'succeeded') {
    return {
      ok: false,
      error:
        'Capture the payment first — you cannot place an order at TPS before the buyer has been charged.',
    }
  }

  await prisma.printOrder.update({
    where: { id: order.id },
    data: { fulfillmentStatus: STAGE_PLACED },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: 'Marked placed at The Print Space',
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
 * Admin CTA: cancel an order before delivery — the catch-all off-ramp for
 * any reason a sale doesn't go through (buyer asked to cancel, we couldn't
 * fulfill, artist disabled prints, TPS rejected the file, etc.). Terminal
 * state. If payment was still authorized we cancel the Stripe PI (releases
 * the hold, no charge); if it was already captured, the admin must use the
 * existing Refund flow to return funds.
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<{ ok: true; needsRefund: boolean } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const trimmedReason = reason.trim()
  if (!trimmedReason) return { ok: false, error: 'A reason is required.' }

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.paymentStatus === 'refunded' || order.paymentStatus === 'canceled') {
    return {
      ok: false,
      error: `Order is ${order.paymentStatus} — it cannot be canceled (already terminal).`,
    }
  }
  if (
    order.fulfillmentStatus === STAGE_COMPLETE ||
    order.fulfillmentStatus === STAGE_CANCELLED ||
    order.fulfillmentStatus === STAGE_REJECTED_LEGACY
  ) {
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
        stage: 'cancel-order-cancel-pi',
        extra: { orderId, paymentIntentId: order.paymentIntentId },
        level: 'error',
        fingerprint: ['admin:cancel-order-pi-failed'],
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
      fulfillmentStatus: STAGE_CANCELLED,
      ...(voided ? { paymentStatus: 'canceled' } : {}),
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: voided
      ? 'Order canceled (Stripe auth voided)'
      : 'Order canceled (manual refund required)',
    payload: { reason: trimmedReason, voided, priorPaymentStatus: order.paymentStatus },
  })

  // Return the edition number to the pool — only while the print was never
  // produced (pre-production cancel). Cancelling a Started/Shipped order
  // keeps the number: a physical copy carrying it already exists. Idempotent
  // and a no-op for open editions.
  if (stageAllowsEditionRelease(order.fulfillmentStatus)) {
    await releaseEditionNumberForPaymentIntent(order.paymentIntentId, { allowSold: true })
  } else {
    await logOrderEvent({
      orderId: order.id,
      kind: 'admin_action',
      actor: `admin:${guard.session.user.id}`,
      message: 'Edition number retained (print already produced — not returned to the pool)',
      payload: { fulfillmentStatus: order.fulfillmentStatus },
    })
  }

  await maybeSendBuyerTransitionEmail(order.id, STAGE_CANCELLED, { trackingUrl: null })

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
  if (order.paymentStatus === 'refunded' || order.paymentStatus === 'canceled') {
    return {
      ok: false,
      error: `Order is ${order.paymentStatus} — no further fulfillment actions are allowed.`,
    }
  }
  if (
    order.fulfillmentStatus === STAGE_COMPLETE ||
    order.fulfillmentStatus === STAGE_CANCELLED ||
    order.fulfillmentStatus === STAGE_REJECTED_LEGACY
  ) {
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
    newStage !== STAGE_CANCELLED
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

  // Surface the buyer's assigned limited-edition number(s) for every email sent
  // from production onward — in-production, shipped and delivered all name the
  // copy. Not before: until production starts the number can still be returned
  // to the pool (see EDITION_NUMBER_NOTICE_BODY). Bound to the order via either
  // the legacy single-print path (orderId) or the cart path
  // (orderItem.orderId). Empty for open editions.
  const editions =
    newStage === STAGE_STARTED || newStage === STAGE_SHIPPED || newStage === STAGE_COMPLETE
      ? (
          await prisma.editionNumber.findMany({
            where: {
              state: { in: ['reserved', 'sold'] },
              OR: [{ orderId: order.id }, { orderItem: { orderId: order.id } }],
            },
            select: {
              number: true,
              variant: { select: { editionSize: true, artwork: { select: { title: true } } } },
            },
            orderBy: { number: 'asc' },
          })
        ).map((e) => ({
          artworkTitle: e.variant.artwork.title ?? '',
          number: e.number,
          editionSize: e.variant.editionSize,
        }))
      : []

  const emailRes =
    newStage === STAGE_STARTED
      ? await sendOrderInProductionEmail({
          to: order.buyerEmail,
          buyerName: order.buyerName,
          orderId: order.id,
          artworkTitle: order.artwork.title ?? '',
          artistName,
          editions,
        })
      : newStage === STAGE_SHIPPED
        ? await sendOrderShippedEmail({
            to: order.buyerEmail,
            buyerName: order.buyerName,
            orderId: order.id,
            artworkTitle: order.artwork.title ?? '',
            artistName,
            trackingUrl: opts.trackingUrl,
            editions,
          })
        : newStage === STAGE_COMPLETE
          ? await sendOrderDeliveredEmail({
              to: order.buyerEmail,
              buyerName: order.buyerName,
              orderId: order.id,
              artworkTitle: order.artwork.title ?? '',
              artistName,
              editions,
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

  if (newStage === STAGE_CANCELLED) {
    const adminAlreadySent = await prisma.printOrderEvent.findFirst({
      where: { orderId, kind: 'email_sent', message: 'admin_order_cancelled' },
      select: { id: true },
    })
    if (!adminAlreadySent) {
      const siteUrl = EMAIL_BRAND.siteUrl
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

// ── Invoicing (AR-131) ────────────────────────────────────────────────────────

type InvoiceDocType = 'invoice' | 'credit_note'

type InvoiceActionResult =
  | { ok: true; number: string; emailed: boolean }
  | { ok: false; error: string }

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Render + archive + email one issued document, reading EVERYTHING from the
 * stored Invoice row (snapshots + linesSnapshot) — never from the live order,
 * so a later order/artwork edit can never alter an issued document. The
 * archived PDF is write-once: if an object already exists at the row's r2Key
 * it is left untouched.
 */
async function deliverInvoiceDocument(args: {
  // Snapshot fields use the canonical shapes from buildInvoiceSnapshots /
  // buildInvoiceLines — the same symbols the writer was checked against.
  record: {
    id: string
    orderId: string
    type: string
    number: string
    issuedAt: Date
    r2Key: string
    sellerSnapshot: SellerSnapshot
    buyerSnapshot: BuyerSnapshot
    totalsSnapshot: TotalsSnapshot
    linesSnapshot: InvoiceLine[] | null
  }
  buyer: { email: string; name: string }
  correctsNumber?: string
  actor: OrderEventActor
  resend: boolean
}): Promise<InvoiceActionResult> {
  const { record, buyer } = args
  const isCreditNote = record.type === 'credit_note'
  const label = isCreditNote ? 'credit note' : 'invoice'
  const stage = isCreditNote ? 'credit-note' : 'invoice'

  const totals = record.totalsSnapshot
  const lines = record.linesSnapshot
  if (!Array.isArray(lines) || lines.length === 0) {
    // Row created before linesSnapshot existed (pre-fix dev data). Rebuilding
    // lines from the live order would let a mutated order change an issued
    // document — refuse instead.
    return {
      ok: false,
      error: `${label} ${record.number} predates line snapshots — reset dev invoicing data (scripts/reset-invoicing.ts) and re-issue.`,
    }
  }

  let pdf: Buffer
  try {
    pdf = await renderInvoicePdf({
      number: record.number,
      issuedAt: record.issuedAt,
      type: isCreditNote ? 'credit_note' : 'invoice',
      correctsNumber: args.correctsNumber,
      reason: totals.reason,
      sellerSnapshot: record.sellerSnapshot,
      buyerSnapshot: record.buyerSnapshot,
      totalsSnapshot: totals,
      lines,
    })
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: `${stage}-render-pdf`,
      extra: { orderId: record.orderId, invoiceId: record.id, number: record.number },
      level: 'error',
      fingerprint: [`${stage}:render-pdf-failed`],
    })
    // NUMBER-BURN RULE: the number stays committed; a retry re-renders from
    // the same stored row.
    return {
      ok: false,
      error: `PDF render failed (${label} ${record.number} is committed — retry to re-send): ${errMsg(err)}`,
    }
  }

  // Archive is write-once: only upload when no object exists at the key yet.
  try {
    if (!(await r2ObjectExists(record.r2Key))) {
      await uploadPrivateToR2(record.r2Key, pdf, 'application/pdf')
    }
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: `${stage}-upload-pdf`,
      extra: {
        orderId: record.orderId,
        invoiceId: record.id,
        number: record.number,
        key: record.r2Key,
      },
      level: 'error',
      fingerprint: [`${stage}:upload-pdf-failed`],
    })
    // Non-fatal — the row is committed and the email attaches the buffer
    // directly. The ZIP export flags rows whose PDF is missing.
    console.warn(`[${stage}] R2 upload failed for ${record.number}:`, err)
  }

  const emailRes = await sendInvoiceEmail({
    to: buyer.email,
    buyerName: buyer.name,
    number: record.number,
    pdf,
    ...(isCreditNote ? { isCreditNote: true } : {}),
  })
  await logOrderEvent({
    orderId: record.orderId,
    kind: emailRes.ok ? 'email_sent' : 'email_failed',
    actor: args.actor,
    message: `${isCreditNote ? 'credit_note' : 'invoice'}${args.resend ? '_resent' : ''}:${record.number}`,
    payload: emailRes.ok
      ? { to: buyer.email, resendId: emailRes.id, number: record.number }
      : { to: buyer.email, error: emailRes.error, number: record.number },
  })
  if (!emailRes.ok) {
    captureError(new Error(`${label} email failed: ${emailRes.error}`), {
      flow: 'admin',
      stage: `${stage}-send-email`,
      extra: {
        orderId: record.orderId,
        invoiceId: record.id,
        number: record.number,
        to: buyer.email,
      },
      level: 'warning',
      fingerprint: [`${stage}:send-email-failed`],
    })
  }

  // emailed:false ⇒ the document is issued and archived but the buyer did NOT
  // receive it — the UI must surface that, never treat it as a full success.
  return { ok: true, number: record.number, emailed: emailRes.ok }
}

/** Shared issue-or-resend pipeline behind sendInvoice / issueCreditNote. */
async function issueOrResendInvoiceDocument(
  orderId: string,
  opts: { type: InvoiceDocType; reason?: string; actor: OrderEventActor },
): Promise<InvoiceActionResult> {
  const isCreditNote = opts.type === 'credit_note'
  const label = isCreditNote ? 'credit note' : 'invoice'

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      artwork: { select: { title: true, slug: true } },
      items: {
        include: { artwork: { select: { title: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
      },
      invoices: { orderBy: { issuedAt: 'asc' } },
    },
  })
  if (!order) return { ok: false, error: 'Order not found.' }

  const originalInvoice = order.invoices.find((i) => i.type === 'invoice') ?? null
  const existingCreditNote = order.invoices.find((i) => i.type === 'credit_note') ?? null

  if (isCreditNote && !originalInvoice) {
    return { ok: false, error: 'Issue the invoice before a credit note.' }
  }
  if (!isCreditNote && existingCreditNote) {
    // The invoice was voided; re-sending it alone would tell a refunded buyer
    // they owe the full amount again.
    return {
      ok: false,
      error: `This invoice was voided by credit note ${existingCreditNote.number} — re-send the credit note instead.`,
    }
  }

  const buyer = { email: order.buyerEmail, name: order.buyerName }
  const correctsNumber = isCreditNote ? originalInvoice!.number : undefined

  // ── Idempotent re-send: the document already exists → deliver from storage.
  //    No fulfillment-stage gate anywhere in this flow — the admin issues
  //    manually, at any stage (deliberate).
  const existing = isCreditNote ? existingCreditNote : originalInvoice
  if (existing) {
    return deliverInvoiceDocument({
      // Prisma-Json → typed boundary: this row was written by
      // issueInvoiceRecord from the same canonical types.
      record: existing as unknown as Parameters<typeof deliverInvoiceDocument>[0]['record'],
      buyer,
      correctsNumber,
      actor: opts.actor,
      resend: true,
    })
  }

  // ── First issue. Validation runs BEFORE the number is minted: a defective
  //    document (missing mandatory field, empty or non-reconciling lines, VAT
  //    inconsistent with the stamped rate) must never burn a number.
  let prepared: ReturnType<typeof prepareInvoiceIssue>
  try {
    prepared = prepareInvoiceIssue(order, { negate: isCreditNote, reason: opts.reason })
  } catch (err) {
    return { ok: false, error: `Cannot issue ${label}: ${errMsg(err)}` }
  }

  // Atomically mint the number + insert the row. Race-safe: a concurrent call
  // that already minted this order's document wins the @@unique([orderId,
  // type]) constraint and its row is reused — same number, never a second one.
  // NUMBER-BURN RULE: render/email stay OUTSIDE this step.
  let minted: Awaited<ReturnType<typeof getOrIssueInvoice>>
  try {
    minted = await getOrIssueInvoice({
      type: opts.type,
      orderId,
      currency: order.currency,
      r2Key: buildInvoiceKey(orderId, isCreditNote ? 'cn' : 'inv'),
      sellerSnapshot: prepared.snapshots.sellerSnapshot,
      buyerSnapshot: prepared.snapshots.buyerSnapshot,
      totalsSnapshot: prepared.snapshots.totalsSnapshot,
      linesSnapshot: prepared.lines,
      ...(isCreditNote && originalInvoice ? { correctsInvoiceId: originalInvoice.id } : {}),
    })
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: `${isCreditNote ? 'credit-note' : 'invoice'}-issue-record`,
      extra: { orderId },
      level: 'error',
      fingerprint: [`${isCreditNote ? 'credit-note' : 'invoice'}:issue-record-failed`],
    })
    return { ok: false, error: `${label} numbering failed: ${errMsg(err)}` }
  }

  if (!minted.reused) {
    await logOrderEvent({
      orderId,
      kind: isCreditNote ? 'credit_note_issued' : 'invoice_issued',
      actor: opts.actor,
      message: minted.invoice.number,
      payload: isCreditNote
        ? {
            creditNoteId: minted.invoice.id,
            number: minted.invoice.number,
            correctsInvoiceId: originalInvoice?.id,
          }
        : { invoiceId: minted.invoice.id, number: minted.invoice.number },
    })
  }

  return deliverInvoiceDocument({
    record: minted.invoice,
    buyer,
    correctsNumber,
    actor: opts.actor,
    resend: minted.reused,
  })
}

/**
 * Issue (or re-send) the gallery invoice for an order.
 *
 * No fulfillment-stage gate — the admin issues manually, at any stage.
 * IDEMPOTENT: a second call re-sends the SAME document number, enforced at the
 * DB level by @@unique([orderId, type]) — no double-billing even under a
 * concurrent double-click.
 * NUMBER-BURN RULE: the number is committed inside the minting transaction; a
 * later PDF render / email failure does NOT roll it back. Re-sends render from
 * the STORED snapshots + linesSnapshot, never from the live order, and never
 * overwrite the archived PDF.
 * Returns `emailed: false` when the document was issued but the buyer email
 * failed — callers must surface that, not treat it as a full success.
 */
export async function sendInvoice(orderId: string): Promise<InvoiceActionResult> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard
  return issueOrResendInvoiceDocument(orderId, {
    type: 'invoice',
    actor: `admin:${guard.session.user.id}`,
  })
}

/**
 * Issue (or re-send) a credit note for an order that
 * already has an invoice. Same idempotency / number-burn / stored-snapshot
 * rules as sendInvoice. The optional `reason` is stored inside the credit
 * note's totalsSnapshot JSON (no schema column) and read back on re-sends.
 */
export async function issueCreditNote(
  orderId: string,
  reason?: string,
): Promise<InvoiceActionResult> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard
  return issueOrResendInvoiceDocument(orderId, {
    type: 'credit_note',
    reason,
    actor: `admin:${guard.session.user.id}`,
  })
}
