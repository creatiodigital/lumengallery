'use server'

import crypto from 'node:crypto'

import {
  type ProviderId,
  type WizardConfig,
  buildAvailability,
  configShipsTo,
  findConfigRestrictionClash,
} from '@/lib/print-providers'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { getVatRate } from '@/lib/print-providers/printspace/pricing'
import { getProviderQuote } from '@/lib/print-providers/quote'
import type { PrintRestrictions } from '@/lib/print-providers/types'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'
import { sanitizeLine } from '@/utils/sanitizeLine'

export type ShippingAddress = {
  fullName: string
  email: string
  phone: string
  countryCode: string
  address1: string
  address2: string
  city: string
  stateOrRegion: string
  postalCode: string
}

export type CreatePaymentIntentInput = {
  artworkSlug: string
  /** Server-resolved provider for this artwork. Client passes it back
   *  so we can dispatch quotes against the correct adapter. */
  providerId: ProviderId
  /** Provider-agnostic buyer config (the wizard's full state). */
  config: WizardConfig
  address: ShippingAddress
}

export type CreatePaymentIntentResult =
  | {
      ok: true
      clientSecret: string
      paymentIntentId: string
      totals: {
        productionCents: number
        shippingCents: number
        artistCents: number
        galleryCents: number
        customerVatCents: number
        totalCents: number
        currency: string
      }
    }
  | { ok: false; error: string }

const GALLERY_MARKUP_RATE = 0.45

/**
 * Hard ceiling on the buyer-facing total. Any computed total above this
 * is treated as a config-tamper signal — we'd rather reject than charge
 * an absurd amount on the customer's card while we figure out why our
 * pricing produced it. €10,000 is well above any plausible single-print
 * order (largest TPS framed prints land ≈ €1,500).
 */
const MAX_TOTAL_CENTS = 1_000_000

/** Defensive validation — confirms the wizard config is well-formed
 *  before we trust it for pricing. Guards against tampered POSTs that
 *  bypass the wizard's client-side validation. */
function validateConfigShape(config: unknown): config is WizardConfig {
  if (!config || typeof config !== 'object') return false
  const c = config as Record<string, unknown>
  if (!c.values || typeof c.values !== 'object') return false
  for (const [, v] of Object.entries(c.values as Record<string, unknown>)) {
    if (typeof v !== 'string') return false
  }
  if (c.customSize !== undefined) {
    const cs = c.customSize as Record<string, unknown>
    if (
      typeof cs.widthCm !== 'number' ||
      typeof cs.heightCm !== 'number' ||
      cs.widthCm <= 0 ||
      cs.heightCm <= 0 ||
      cs.widthCm > 500 ||
      cs.heightCm > 500
    ) {
      return false
    }
  }
  if (c.borders !== undefined) {
    const bs = c.borders as Record<string, unknown>
    for (const [, b] of Object.entries(bs)) {
      const bb = b as Record<string, unknown>
      if (typeof bb?.allCm !== 'number' || bb.allCm < 0 || bb.allCm > 50) return false
    }
  }
  return true
}

/** Whitelist `providerId` to known literals — guards the dispatch from
 *  unknown values being passed through if the abstraction grows. */
function isKnownProvider(id: unknown): id is ProviderId {
  return id === 'printspace'
}

// sanitizeLine moved to @/utils/sanitizeLine

/**
 * Server-authoritative payment setup. Quotes the order against TPS so we
 * don't trust the number the client saw, then opens a Stripe
 * PaymentIntent for the final total Stripe Tax computed.
 *
 * Metadata carries everything the post-payment webhook needs to create
 * the local PrintOrder row: the `wizardConfig` JSON blob (so we can
 * reconstruct the buyer's exact selection), the buyer's address, and
 * the per-line cents breakdown for the admin order page.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<CreatePaymentIntentResult> {
  const { artworkSlug, providerId, config, address } = input

  // ── Defensive input validation ──────────────────────────────
  // These run BEFORE we hit the DB / catalog / Stripe. A malformed
  // payload is a tamper signal, not user error — we return a generic
  // message rather than exposing which check tripped.
  if (!isKnownProvider(providerId)) {
    return { ok: false, error: 'Invalid request. Please reload and try again.' }
  }
  if (!validateConfigShape(config)) {
    return { ok: false, error: 'Invalid request. Please reload and try again.' }
  }
  if (!address?.countryCode || address.countryCode.length !== 2) {
    return { ok: false, error: 'Invalid request. Please reload and try again.' }
  }
  // Address strings: type-check first, then sanitize (strip control
  // chars, zero-width Unicode, collapse whitespace), then length-check.
  // Length cap kicks in AFTER sanitize so a tampered payload that's
  // padded with control chars can't sneak past via raw byte count.
  const rawFields = [
    address.fullName,
    address.email,
    address.phone,
    address.address1,
    address.address2,
    address.city,
    address.stateOrRegion,
    address.postalCode,
  ]
  if (rawFields.some((s) => typeof s !== 'string')) {
    return { ok: false, error: 'Invalid request. Please reload and try again.' }
  }

  // Mutate `address` in place with sanitized values. Downstream code
  // (Stripe metadata, PI shipping, DB write via webhook) all read from
  // here, so cleaning once at the boundary is enough.
  address.fullName = sanitizeLine(address.fullName)
  address.email = sanitizeLine(address.email)
  address.phone = sanitizeLine(address.phone)
  address.address1 = sanitizeLine(address.address1)
  address.address2 = sanitizeLine(address.address2)
  address.city = sanitizeLine(address.city)
  address.stateOrRegion = sanitizeLine(address.stateOrRegion)
  address.postalCode = sanitizeLine(address.postalCode)

  const sanitizedFields = [
    address.fullName,
    address.email,
    address.phone,
    address.address1,
    address.address2,
    address.city,
    address.stateOrRegion,
    address.postalCode,
  ]
  if (sanitizedFields.some((s) => s.length > 200)) {
    return { ok: false, error: 'Invalid request. Please reload and try again.' }
  }
  // Required-field presence check (post-sanitize, so a pure-whitespace
  // input that the client smuggled past `required` is rejected here).
  if (
    !address.fullName ||
    !address.email ||
    !address.phone ||
    !address.address1 ||
    !address.city ||
    !address.postalCode
  ) {
    return { ok: false, error: 'Invalid request. Please reload and try again.' }
  }
  // Email must contain at least one '@' and one '.' after it. Cheap
  // structural check on top of HTML5 client validation; Stripe + Resend
  // do their own format checks downstream too.
  const atIndex = address.email.indexOf('@')
  if (atIndex < 1 || address.email.indexOf('.', atIndex) < 0) {
    return { ok: false, error: 'Invalid request. Please reload and try again.' }
  }

  const artwork = await prisma.artwork.findUnique({
    where: { slug: artworkSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      userId: true,
      printEnabled: true,
      printPriceCents: true,
      printOptions: true,
      originalWidth: true,
      originalHeight: true,
    },
  })
  if (!artwork) {
    return { ok: false, error: 'Artwork not found.' }
  }
  if (!artwork.printEnabled || !artwork.printPriceCents) {
    return { ok: false, error: 'This artwork is not currently available as a print.' }
  }

  // Defend against a wizard that had stale restrictions: if the artist
  // narrowed what's allowed while the buyer was configuring, reject the
  // now-disallowed config here rather than submitting it to the
  // provider. We need the catalog to evaluate dimension visibility
  // (transitive rules), so load it first.
  const catalog = await loadProviderCatalog(providerId, {
    imageWidthPx: artwork.originalWidth ?? 1000,
    imageHeightPx: artwork.originalHeight ?? 1000,
  })

  // Reject destinations the resolved provider doesn't actually ship to.
  if (!catalog.supportedCountries.includes(address.countryCode)) {
    return {
      ok: false,
      error: "We can't ship this artwork to your destination. Please choose another country.",
    }
  }

  // Reject configs that don't ship as a coherent (config × country)
  // combination — catches stale URLs where the wizard's selection no
  // longer satisfies the provider's per-SKU shipsTo rules.
  const availability = buildAvailability(catalog)
  if (!configShipsTo(catalog, config, address.countryCode, availability)) {
    return {
      ok: false,
      error:
        "Your configuration can't be shipped to this destination. " +
        'Please go back and adjust your selection.',
    }
  }

  const restrictions = (artwork.printOptions as PrintRestrictions | null) ?? null
  const clash = findConfigRestrictionClash(catalog, config, restrictions)
  if (clash) {
    return {
      ok: false,
      error:
        `The ${clash.dimensionLabel.toLowerCase()} you chose isn't available for this artwork any more. ` +
        'Please go back to the print options and pick a different one.',
    }
  }

  const artistCents = artwork.printPriceCents
  const galleryCents = Math.round(artistCents * GALLERY_MARKUP_RATE)

  const quote = await getProviderQuote(providerId, {
    config,
    country: address.countryCode,
    artistPriceCents: artistCents,
  })

  // Provider Quote.lines layout: [{id:'artwork', amount}, {id:'shipping', amount}]
  // The 'artwork' line bundles artist + gallery + production cost
  // together; we split them out for the order metadata so the admin
  // page can show the breakdown without recomputing.
  const artworkLineCents = quote.lines.find((l) => l.id === 'artwork')?.amountCents ?? 0
  const shippingCents = quote.lines.find((l) => l.id === 'shipping')?.amountCents ?? 0
  const productionCents = Math.max(0, artworkLineCents - artistCents - galleryCents)
  const preTaxCents = quote.subtotalCents
  const currency = quote.currency.toLowerCase()

  // VAT is computed from the same local rate table the address-step
  // quote uses (getVatRate in printspace/pricing.ts), so the buyer sees
  // the same number on both surfaces. Accountant input pending before
  // we model OSS thresholds, postal-aware Canary/Ceuta/Melilla, or
  // B2B reverse-charge — for now this is a flat per-country rate.
  const vatRate = getVatRate(address.countryCode)
  const customerVatCents = Math.round(preTaxCents * vatRate)
  const totalCents = preTaxCents + customerVatCents

  // Final sanity check — anything above the ceiling is treated as a
  // pricing-tamper signal and refused. Logged so we can investigate.
  if (totalCents <= 0 || totalCents > MAX_TOTAL_CENTS) {
    captureError(new Error(`Implausible total ${totalCents} cents — refused`), {
      flow: 'payment',
      stage: 'create-payment-intent',
      extra: { artworkId: artwork.id, providerId, totalCents, country: address.countryCode },
      level: 'warning',
      fingerprint: ['payment:total-out-of-range'],
    })
    return { ok: false, error: 'Could not finalize this order. Please try again or contact us.' }
  }

  // Idempotency key guards against double-submits. Client-side we already
  // disable the button while `submitting` is true; this is the server-side
  // belt-and-braces. Same (artwork, config, address, total) reuses the
  // cached PaymentIntent — proper idempotency, so accidental double-clicks
  // don't create duplicate authorizations.
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        artworkId: artwork.id,
        providerId,
        config,
        address,
        totalCents,
        currency,
      }),
    )
    .digest('hex')

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: totalCents,
        currency,
        automatic_payment_methods: { enabled: true },
        // Manual capture — we authorize now, capture only when the
        // provider confirms the order has been allocated for production.
        // See memory/project_payment_auth_capture.md for the full flow.
        capture_method: 'manual',
        receipt_email: address.email || undefined,
        description: `Print: ${artwork.title ?? artwork.slug}`,
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
        metadata: {
          artworkSlug: artwork.slug ?? artworkSlug,
          artworkId: artwork.id,
          artistUserId: artwork.userId,
          providerId,
          // Wizard config as a JSON blob — provider-agnostic. Stripe
          // metadata values are strings up to 500 chars; a typical
          // WizardConfig is ~200–400 chars (a dozen short ids + a
          // small customSize/borders shape), so it fits comfortably.
          wizardConfig: JSON.stringify(config),
          countryCode: address.countryCode,
          customerEmail: address.email,
          // Per-line breakdown for the admin order page. "Production"
          // is the TPS print-base + frame + glass + mount cost.
          productionCents: String(productionCents),
          shippingCents: String(shippingCents),
          artistCents: String(artistCents),
          galleryCents: String(galleryCents),
          customerVatCents: String(customerVatCents),
        },
      },
      { idempotencyKey },
    )

    if (!pi.client_secret) {
      return { ok: false, error: 'Payment could not be initialized. Please try again.' }
    }

    return {
      ok: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      totals: {
        productionCents,
        shippingCents,
        artistCents,
        galleryCents,
        customerVatCents,
        totalCents,
        currency,
      },
    }
  } catch (err) {
    console.error('[createPaymentIntent] Stripe failed:', err)
    captureError(err, {
      flow: 'payment',
      stage: 'create-payment-intent',
      extra: {
        artworkId: artwork.id,
        artistUserId: artwork.userId,
        providerId,
        country: address.countryCode,
        totalCents,
        currency,
      },
      level: 'error',
      fingerprint: ['payment:create-intent-failed'],
    })
    return {
      ok: false,
      error: 'Payment could not be initialized. Please try again.',
    }
  }
}
