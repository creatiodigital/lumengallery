'use server'

import crypto from 'node:crypto'

import { Prisma } from '@/generated/prisma'
import type { CartLikeItem, CartTotals } from '@/lib/cart/validateCart'
import { validateCart } from '@/lib/cart/validateCart'
import {
  attachPaymentIntentToReservation,
  reserveNextEditionNumber,
} from '@/lib/editions/reserveEditionNumber'
import { releaseEditionNumberById } from '@/lib/editions/releaseEditionNumber'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

/**
 * AR-129 Task 8a — multi-item (cart) PaymentIntent creation.
 *
 * Server-authoritative: re-runs validateCart (never trusting the totals the
 * client already saw), re-verifies/replaces every limited-edition hold,
 * opens ONE manual-capture Stripe PaymentIntent for the whole order, binds
 * the held numbers to it, persists a PendingCart row the webhook (Task 9)
 * builds PrintOrderItem rows from, and returns a clientSecret.
 *
 * Payment model (unchanged from single-print, see
 * memory/project_payment_auth_capture.md): capture_method 'manual' — we
 * authorize now and capture later when the admin places the order at TPS.
 */

/** A cart line as it arrives at checkout. Limited lines carry the
 *  client-held edition numbers reserved while the item sat in the cart. */
export type CartCheckoutItem = CartLikeItem & { editionNumberIds?: string[] }

export type CreateCartPaymentIntentInput = {
  items: CartCheckoutItem[]
  address: ShippingAddress
}

export type CreateCartPaymentIntentResult =
  | { ok: true; clientSecret: string; paymentIntentId: string; totals: CartTotals }
  | { ok: false; error: string }

export async function createCartPaymentIntent(
  input: CreateCartPaymentIntentInput,
): Promise<CreateCartPaymentIntentResult> {
  const { items, address } = input

  // ── 1. Server-authoritative re-validation + pricing ──────────────
  // The cart lives in localStorage; we re-price every line against the
  // live catalog and NEVER trust client-sent money. validateCart's totals
  // are the only authority for the amount we charge.
  const validation = await validateCart(items, address)
  if (!validation.ok) {
    // Surface the first failing line so the buyer knows what to fix.
    const first = validation.failures[0]
    return {
      ok: false,
      error: first?.error ?? 'Some items in your cart are no longer available.',
    }
  }
  const { totals } = validation

  // Index the authoritative per-line money/identity/config by lineId so we
  // can fold it together with the resolved edition numbers below.
  const pricedByLine = new Map(totals.perItem.map((p) => [p.lineId, p]))

  // ── 2. Edition re-verify + replace (per spec §§3/5) ──────────────
  // For each LIMITED line we need exactly `quantity` valid held numbers.
  // We REUSE the client's still-valid cart holds and only reserve the
  // deficit fresh — never double-consuming stock.
  //
  // `freshlyReservedIds` tracks only the numbers WE reserved in THIS call,
  // so on a later failure we release exactly those and leave the buyer's
  // pre-existing holds intact for a retry.
  const freshlyReservedIds: string[] = []
  // lineId → the final set of number ids for that line (length === quantity).
  const lineNumberIds = new Map<string, string[]>()

  for (const item of items) {
    if (item.editionType !== 'limited' || !item.variantId) continue
    const variantId = item.variantId
    const quantity = item.quantity

    // a. Verify the client-supplied ids: still-valid cart holds (reserved,
    //    no PI, no order item) for THIS variant — these are reused as-is.
    const candidateIds = item.editionNumberIds ?? []
    let validIds: string[] = []
    if (candidateIds.length > 0) {
      const validRows = await prisma.editionNumber.findMany({
        where: {
          id: { in: candidateIds },
          variantId,
          state: 'reserved',
          paymentIntentId: null,
          orderItemId: null,
        },
        select: { id: true },
      })
      // Cap at quantity in case a stale tab sent more ids than it needs.
      validIds = validRows.slice(0, quantity).map((r) => r.id)
    }

    // b. Reserve the deficit (lapsed/swept holds) one number at a time.
    const deficit = quantity - validIds.length
    let soldOut = false
    for (let i = 0; i < deficit; i++) {
      const reserved = await reserveNextEditionNumber({
        variantId,
        buyerEmail: address.email,
      })
      if (!reserved.ok) {
        soldOut = true
        break
      }
      validIds.push(reserved.numberId)
      freshlyReservedIds.push(reserved.numberId)
    }

    // c. Still short → sold out. Release our replacements (NOT the buyer's
    //    pre-existing holds) and bail.
    if (soldOut || validIds.length < quantity) {
      for (const id of freshlyReservedIds) {
        await releaseEditionNumberById(id)
      }
      return {
        ok: false,
        error: 'This edition has just sold out. Please adjust your cart.',
      }
    }

    lineNumberIds.set(item.lineId, validIds)
  }

  // ── 3. Idempotency key over the order-defining inputs ────────────
  // A double-submit with identical (items, address, total, currency)
  // returns the SAME PaymentIntent. We hash a minimal stable shape — the
  // client-chosen identity per line plus the authoritative total/currency.
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        items: items.map((it) => ({
          lineId: it.lineId,
          artworkSlug: it.artworkSlug,
          variantId: it.variantId ?? null,
          config: it.config,
          quantity: it.quantity,
        })),
        address,
        totalCents: totals.totalCents,
        currency: totals.currency,
      }),
    )
    .digest('hex')

  // ── 4–7. Create the PI, bind numbers, persist PendingCart ────────
  // Wrap from PI creation onward so a Stripe failure releases ONLY the
  // replacements we reserved this call.
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: totals.totalCents,
        currency: totals.currency,
        automatic_payment_methods: { enabled: true },
        // Manual capture — authorize now, capture only when the admin
        // places the order at the provider. One PI for the whole cart.
        capture_method: 'manual',
        receipt_email: address.email || undefined,
        description: `Cart: ${items.length} item(s)`,
        shipping: {
          name: address.fullName,
          phone: address.phone || undefined,
          address: {
            line1: address.address1,
            line2: address.address2 || undefined,
            city: address.city,
            state: address.stateOrRegion || undefined,
            postal_code: address.postalCode,
            country: address.countryCode,
          },
        },
        // Items are too large for Stripe metadata (500-char values); the
        // PendingCart row is the authoritative item source for the webhook.
        metadata: { kind: 'cart' },
      },
      { idempotencyKey },
    )

    if (!pi.client_secret) {
      for (const id of freshlyReservedIds) {
        await releaseEditionNumberById(id)
      }
      return { ok: false, error: 'Could not start payment. Please try again.' }
    }

    // 5. Idempotent-replay reconciliation (mirrors the single-print guard at
    //    createPaymentIntent.ts:470-477). On a benign double-submit / 3DS
    //    retry / second tab, the SAME idempotencyKey makes Stripe return the
    //    ORIGINAL pi and ignore our new params. The first call already
    //    attached that pi to the buyer's held numbers, so on this replay those
    //    numbers carry a non-null paymentIntentId and fail the candidate
    //    filter (step 2a) — we therefore reserved FRESH numbers above. If we
    //    now attached + persisted those, the originals would be stranded
    //    (paymentIntentId set, not in PendingCart, not sweepable) and the
    //    edition would hold 2N copies for one PI.
    //
    //    Detect the replay by the numbers already bound to THIS pi. If any
    //    exist they are the authoritative set: adopt them per line (grouped by
    //    variant — a cart has at most one limited line per variant), release
    //    everything we freshly reserved this call, and skip re-attach. The
    //    PendingCart upsert below then rewrites with the SAME authoritative
    //    ids, so it stays in sync with what the PI carries.
    const alreadyBound = await prisma.editionNumber.findMany({
      where: { paymentIntentId: pi.id, orderItemId: null },
      select: { id: true, variantId: true },
    })

    if (alreadyBound.length > 0) {
      // Replay path. Group the bound numbers by variant and re-derive each
      // limited line's authoritative ids from them.
      const boundByVariant = new Map<string, string[]>()
      for (const row of alreadyBound) {
        const list = boundByVariant.get(row.variantId) ?? []
        list.push(row.id)
        boundByVariant.set(row.variantId, list)
      }
      const boundIds = new Set(alreadyBound.map((r) => r.id))

      for (const item of items) {
        if (item.editionType !== 'limited' || !item.variantId) continue
        const adopted = (boundByVariant.get(item.variantId) ?? []).slice(0, item.quantity)
        lineNumberIds.set(item.lineId, adopted)
      }

      // Release every number we reserved THIS call that the original PI does
      // not actually carry — these are the surplus that would otherwise leak.
      for (const id of freshlyReservedIds) {
        if (!boundIds.has(id)) {
          await releaseEditionNumberById(id)
        }
      }
      // Numbers already carry the PI; nothing to (re-)attach.
    } else {
      // First call. Bind every held number across all limited lines to this
      // PI, moving them out of cart-hold state so the TTL sweep no longer
      // touches them.
      for (const ids of lineNumberIds.values()) {
        for (const id of ids) {
          await attachPaymentIntentToReservation(id, pi.id)
        }
      }
    }

    // 6. Persist the authoritative PendingCart row. Built from validateCart's
    //    per-line money/identity/config + the resolved edition numbers. Upsert
    //    keyed by paymentIntentId so an idempotent re-submit (same PI) just
    //    rewrites the same row.
    const cartItems = items.map((item) => {
      const priced = pricedByLine.get(item.lineId)
      return {
        lineId: item.lineId,
        artworkId: priced?.artworkId ?? '',
        artistUserId: priced?.artistUserId ?? '',
        variantId: item.variantId ?? null,
        editionType: item.editionType,
        printConfig: priced?.effectiveConfig ?? item.config,
        quantity: item.quantity,
        productionCents: priced?.lineProductionCents ?? 0,
        artistCents: priced?.lineArtistCents ?? 0,
        galleryCents: priced?.lineGalleryCents ?? 0,
        editionNumberIds: lineNumberIds.get(item.lineId) ?? [],
      }
    })

    const itemsJson = cartItems as unknown as Prisma.InputJsonValue
    const addressJson = address as unknown as Prisma.InputJsonValue

    await prisma.pendingCart.upsert({
      where: { paymentIntentId: pi.id },
      create: {
        paymentIntentId: pi.id,
        buyerEmail: address.email,
        buyerName: address.fullName,
        shippingAddress: addressJson,
        country: address.countryCode,
        items: itemsJson,
        totalCents: totals.totalCents,
        shippingCents: totals.shippingCents,
        customerVatCents: totals.customerVatCents,
        currency: totals.currency,
      },
      update: {
        buyerEmail: address.email,
        buyerName: address.fullName,
        shippingAddress: addressJson,
        country: address.countryCode,
        items: itemsJson,
        totalCents: totals.totalCents,
        shippingCents: totals.shippingCents,
        customerVatCents: totals.customerVatCents,
        currency: totals.currency,
      },
    })

    // 8. Done.
    return {
      ok: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      totals,
    }
  } catch (err) {
    // 7. Stripe (or the persist) failed after we reserved replacements —
    //    return ONLY the numbers we reserved THIS call to the pool. The
    //    buyer's pre-existing valid holds are left untouched so a retry can
    //    reuse them.
    for (const id of freshlyReservedIds) {
      await releaseEditionNumberById(id)
    }
    captureError(err, {
      flow: 'payment',
      stage: 'create-cart-payment-intent',
      extra: {
        country: address.countryCode,
        totalCents: totals.totalCents,
        currency: totals.currency,
        lineCount: items.length,
      },
      level: 'error',
      fingerprint: ['payment:create-cart-intent-failed'],
    })
    return { ok: false, error: 'Could not start payment. Please try again.' }
  }
}
