'use server'

import crypto from 'node:crypto'

import { Prisma } from '@/generated/prisma'
import type { PendingCartItem } from '@/lib/cart/pendingCartItem'
import type { CartLikeItem, CartTotals } from '@/lib/cart/validateCart'
import { validateCart } from '@/lib/cart/validateCart'
import { getPurchasesPaused } from '@/lib/settings'
import {
  attachPaymentIntentToReservation,
  reserveNextEditionNumber,
} from '@/lib/editions/reserveEditionNumber'
import {
  releaseEditionNumberById,
  releaseEditionNumberForPaymentIntent,
} from '@/lib/editions/releaseEditionNumber'
import { CART_HOLD_TTL_MS, extendCartHold } from '@/lib/editions/reserveForCart'
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

  // ── 0. Purchases kill switch ──────────────────────────────────────
  // The UI hides all purchase surfaces while paused, but a buyer with the
  // payment step already open can still submit — this is the authoritative
  // refusal. New intents only; anything already authorized is untouched.
  if (await getPurchasesPaused()) {
    return { ok: false, error: 'Purchases are temporarily paused — please check back soon.' }
  }

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

  // Return the numbers WE reserved this call to the pool, in parallel. Every
  // failure path funnels through here so there is one release path to reason
  // about. Defaults to the full set; the replay path passes only its surplus.
  const releaseFreshlyReserved = (ids: string[] = freshlyReservedIds) =>
    Promise.all(ids.map((id) => releaseEditionNumberById(id)))

  for (const item of items) {
    if (item.editionType !== 'limited' || !item.variantId) continue
    const variantId = item.variantId
    const quantity = item.quantity

    // a. Verify the client-supplied ids: still-valid cart holds (reserved,
    //    no PI, no order item, TTL not lapsed) for THIS variant — these are
    //    reused as-is. The reservedAt cutoff mirrors sweepExpiredCartHolds:
    //    an already-expired hold must count as deficit (fresh re-reserve
    //    below), not be adopted — adopting it would carry a sweepable
    //    reservedAt through the multi-second Stripe round-trip, exactly the
    //    window in which a concurrent buyer's sweep can reclaim the row.
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
          reservedAt: { gte: new Date(Date.now() - CART_HOLD_TTL_MS) },
        },
        select: { id: true },
      })
      // Cap at quantity in case a stale tab sent more ids than it needs.
      validIds = validRows.slice(0, quantity).map((r) => r.id)
      // Restart the adopted holds' clock now that checkout has begun, so a
      // hold with (say) 20s of TTL left can't lapse mid-Stripe-call.
      if (validIds.length > 0) await extendCartHold(validIds)
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
      await releaseFreshlyReserved()
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
  // Best-effort human summary of WHAT was bought, written onto the PI so the
  // order is identifiable + fulfillable from Stripe alone — never just
  // "Cart: N item(s)". Cosmetic: any failure here falls back to the bland
  // description so it can NEVER block the payment.
  let piDescription = `Cart: ${items.length} item(s)`
  const piMetadata: Record<string, string> = { kind: 'cart' }
  try {
    const allNumberIds = Array.from(lineNumberIds.values()).flat()
    const numberRows = allNumberIds.length
      ? await prisma.editionNumber.findMany({
          where: { id: { in: allNumberIds } },
          select: { id: true, number: true },
        })
      : []
    const numberById = new Map(numberRows.map((r) => [r.id, r.number]))

    const variantIds = items.map((i) => i.variantId).filter((v): v is string => Boolean(v))
    const variantRows = variantIds.length
      ? await prisma.limitedVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, editionSize: true },
        })
      : []
    const sizeByVariant = new Map(variantRows.map((v) => [v.id, v.editionSize]))

    const lineStrings = items.map((item) => {
      const priced = pricedByLine.get(item.lineId)
      const title = priced?.title ?? item.artworkSlug
      const specs = (priced?.specsSummary ?? []).map((s) => s.value).join(', ')
      const ids = lineNumberIds.get(item.lineId) ?? []
      const nums = ids
        .map((id) => numberById.get(id))
        .filter((n): n is number => n != null)
        .sort((a, b) => a - b)
      const size = item.variantId ? sizeByVariant.get(item.variantId) : undefined
      const edition = nums.length && size ? ` · No.${nums.join(',')}/${size}` : ''
      const qty = item.quantity > 1 ? ` ×${item.quantity}` : ''
      return `${title}${specs ? ` — ${specs}` : ''}${edition}${qty}`.trim()
    })

    // Stripe caps description at 1000 chars; truncate safely.
    const joined = lineStrings.join(' | ')
    if (joined) piDescription = joined.length > 990 ? `${joined.slice(0, 986)} …` : joined
    // Per-item metadata: ≤50 keys / ≤500 chars each (Stripe limits).
    lineStrings.slice(0, 40).forEach((s, i) => {
      piMetadata[`item_${i + 1}`] = s.length > 500 ? `${s.slice(0, 497)}…` : s
    })
  } catch (summaryErr) {
    console.warn(
      '[create-cart-pi] order summary build failed (non-fatal):',
      summaryErr instanceof Error ? summaryErr.message : summaryErr,
    )
  }

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
        description: piDescription,
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
        // A per-item order summary (title · specs · edition no · qty), so the
        // order is identifiable from Stripe alone. The PendingCart row remains
        // the AUTHORITATIVE item source for the webhook; this is for humans.
        metadata: piMetadata,
      },
      { idempotencyKey },
    )

    if (!pi.client_secret) {
      await releaseFreshlyReserved()
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
      await releaseFreshlyReserved(freshlyReservedIds.filter((id) => !boundIds.has(id)))
      // Numbers already carry the PI; nothing to (re-)attach.
    } else {
      // First call. Bind every held number across all limited lines to this
      // PI, moving them out of cart-hold state so the TTL sweep no longer
      // touches them. Attach is GUARDED (see reserveEditionNumber.ts): if a
      // hold lapsed and another buyer claimed the row during the Stripe
      // round-trip, the attach reports failure instead of clobbering their
      // reservation. In that case unwind OUR rows only and bail — the buyer
      // re-runs checkout with fresh holds; the untouched PI is reused by the
      // idempotency key on retry.
      const attachedIds = new Set<string>()
      let lostHold = false
      for (const ids of lineNumberIds.values()) {
        for (const id of ids) {
          const attached = await attachPaymentIntentToReservation(id, pi.id)
          if (attached) attachedIds.add(id)
          else lostHold = true
        }
      }
      if (lostHold) {
        // Rows attached to our PI are provably ours — free them by PI. Fresh
        // reserves that never got attached are freed by id; skip the attached
        // ones (just freed above) so we can't re-release a row a faster buyer
        // immediately re-claims. The stolen row itself is left alone — it
        // belongs to its new owner.
        await releaseEditionNumberForPaymentIntent(pi.id)
        await releaseFreshlyReserved(freshlyReservedIds.filter((id) => !attachedIds.has(id)))
        return {
          ok: false,
          error:
            'Your hold on a limited edition expired during checkout. Please review your cart and try again.',
        }
      }
    }

    // 6. Persist the authoritative PendingCart row. Built from validateCart's
    //    per-line money/identity/config + the resolved edition numbers. Upsert
    //    keyed by paymentIntentId so an idempotent re-submit (same PI) just
    //    rewrites the same row.
    const cartItems: PendingCartItem[] = items.map((item): PendingCartItem => {
      // validateCart returns a priced entry for every line it didn't fail, and
      // we already bailed on !validation.ok above — so a miss here is a logic
      // error, not a benign absence. Throw rather than persist an empty/zero
      // line: the catch below releases our held numbers and reports it, which
      // beats persisting a €0, artist-less row the webhook would build an
      // order and split payouts from.
      const priced = pricedByLine.get(item.lineId)
      if (!priced) {
        throw new Error(`Cart line ${item.lineId} missing from validated pricing`)
      }
      return {
        lineId: item.lineId,
        artworkId: priced.artworkId,
        artistUserId: priced.artistUserId,
        variantId: item.variantId ?? null,
        editionType: item.editionType,
        printConfig: priced.effectiveConfig,
        quantity: item.quantity,
        productionCents: priced.lineProductionCents,
        artistCents: priced.lineArtistCents,
        galleryCents: priced.lineGalleryCents,
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
    await releaseFreshlyReserved()
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
