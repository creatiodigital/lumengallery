/**
 * Shared, server-authoritative per-ITEM validation + pricing.
 *
 * This is the single source of truth for the per-item guards that turn a
 * buyer's wizard selection into a trusted price. It is consumed by BOTH:
 *   - the single-print path (createPaymentIntent.ts), and
 *   - the cart path (validateCart.ts),
 * so the two surfaces can never drift on what's allowed or what it costs.
 *
 * It performs exactly the per-item guards from createPaymentIntent.ts
 * (artwork load → printEnabled → open/limited fork → catalog load →
 * supportedCountries → configShipsTo → open-only restriction clash →
 * money split + quote). It deliberately does NOT compute VAT or any
 * order-level total: VAT is applied once on the whole-order taxable base
 * by the caller (per-country, see getVatRate), so this helper returns the
 * per-item PRE-TAX pricing only.
 *
 * NOTE — intentional duplication: this mirrors createPaymentIntent.ts's
 * per-item guards rather than the single-print path being refactored to
 * call this helper. A clean behavior-preserving extraction would force
 * either a second artwork query or widening this helper's return shape to
 * hand back the artwork row (createPaymentIntent reuses artwork.id /
 * userId / slug / title afterwards for the idempotency hash, edition
 * reservation, Stripe metadata and error reporting). To keep the
 * single-print path provably stable and this helper's signature exactly
 * as specified, the two are kept in lockstep by review, not by sharing.
 * Any change to these guards must be applied in BOTH files.
 */
import {
  type ProviderId,
  type WizardConfig,
  buildAvailability,
  configShipsTo,
  findConfigRestrictionClash,
} from '@/lib/print-providers'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { TPS_GALLERY_MARKUP_RATE } from '@/lib/print-providers/printspace/pricing'
import { getProviderQuote } from '@/lib/print-providers/quote'
import { summarizeConfig, type SpecsSummary } from '@/lib/print-providers/specs'
import type { PrintRestrictions } from '@/lib/print-providers/types'
import { variantToWizardConfig } from '@/lib/editions/variantToWizardConfig'
import prisma from '@/lib/prisma'

export type ItemValidationInput = {
  artworkSlug: string
  /** Server-resolved provider for this artwork. */
  providerId: ProviderId
  /** Provider-agnostic buyer config (the wizard's full state). For a
   *  limited edition this is ignored — we rebuild it from the variant. */
  config: WizardConfig
  /** For a LIMITED-edition artwork: the variant the buyer picked. Must
   *  be absent for open editions. */
  variantId?: string
  countryCode: string
}

export type ItemPricing = {
  artistCents: number
  galleryCents: number
  productionCents: number
  /** This item's own shipping line (artwork-only context). At the order
   *  level only ONE consolidated parcel fee applies — the MAX over items,
   *  not a sum — so the caller uses this to pick the parcel fee, NOT to add
   *  per-item shipping. */
  shippingCents: number
  /** Per-item pre-tax = the artwork line ONLY (artist + gallery +
   *  production). It deliberately EXCLUDES shipping so the order-level fold
   *  can add the single consolidated parcel fee exactly once. */
  preTaxCents: number
  currency: string
}

export type ItemValidationResult =
  | {
      ok: true
      pricing: ItemPricing
      effectiveConfig: WizardConfig
      /** Identity the webhook (Task 9) needs to build a PrintOrderItem row.
       *  Additive — the single-print path doesn't read these. */
      artworkId: string
      artistUserId: string
      /** Human-readable artwork title + buyer-facing spec rows, for the order
       *  summary written onto the Stripe PaymentIntent (cart path). Additive
       *  and cosmetic — the single-print path doesn't read these. */
      title: string
      specsSummary: SpecsSummary
    }
  | { ok: false; error: string }

/**
 * Validate one item and price it (pre-tax). Mirrors the per-item guards
 * + money split in createPaymentIntent.ts so a cart line and a single
 * print produce identical numbers. VAT is intentionally omitted — it's
 * an order-level concern computed by the caller on the whole-order base.
 */
export async function validateAndPriceItem(
  input: ItemValidationInput,
): Promise<ItemValidationResult> {
  const { artworkSlug, providerId, config, variantId, countryCode } = input

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
      editionType: true,
      limitedVariants: {
        where: { published: true },
        select: {
          id: true,
          paperId: true,
          printTypeId: true,
          widthCm: true,
          heightCm: true,
          borderCm: true,
          priceCents: true,
        },
      },
    },
  })
  if (!artwork) {
    return { ok: false, error: 'Artwork not found.' }
  }
  if (!artwork.printEnabled) {
    return { ok: false, error: 'This artwork is not currently available as a print.' }
  }
  // Open editions need an artwork-level price; limited editions are priced
  // per variant (checked after the variant is resolved below).
  if (artwork.editionType !== 'limited' && !artwork.printPriceCents) {
    return { ok: false, error: 'This artwork is not currently available as a print.' }
  }

  // ── Open vs limited fork ────────────────────────────────────────
  // For a limited edition we IGNORE the client config entirely and pin
  // the canonical config from the chosen (published) variant. For an
  // open edition a supplied variantId is a tamper signal.
  const isLimited = artwork.editionType === 'limited'
  let effectiveConfig: WizardConfig = config
  let pinnedVariant: (typeof artwork.limitedVariants)[number] | null = null
  if (isLimited) {
    if (!variantId) {
      return { ok: false, error: 'Please choose a size for this limited edition.' }
    }
    pinnedVariant = artwork.limitedVariants.find((v) => v.id === variantId) ?? null
    if (!pinnedVariant) {
      return { ok: false, error: 'That edition variant is no longer available.' }
    }
    if (!pinnedVariant.priceCents) {
      return { ok: false, error: 'That edition variant is not currently available.' }
    }
    effectiveConfig = variantToWizardConfig(pinnedVariant)
  } else if (variantId) {
    return { ok: false, error: 'Invalid request. Please reload and try again.' }
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
  if (!catalog.supportedCountries.includes(countryCode)) {
    return {
      ok: false,
      error: "We can't ship this artwork to your destination. Please choose another country.",
    }
  }

  // Reject configs that don't ship as a coherent (config × country)
  // combination — catches stale URLs where the wizard's selection no
  // longer satisfies the provider's per-SKU shipsTo rules.
  const availability = buildAvailability(catalog)
  if (!configShipsTo(catalog, effectiveConfig, countryCode, availability)) {
    return {
      ok: false,
      error:
        "Your configuration can't be shipped to this destination. " +
        'Please go back and adjust your selection.',
    }
  }

  // Artist restrictions are an open-edition concept; a limited variant is
  // server-pinned so it can't clash. Only check for open editions.
  if (!isLimited) {
    const restrictions = (artwork.printOptions as PrintRestrictions | null) ?? null
    const clash = findConfigRestrictionClash(catalog, effectiveConfig, restrictions)
    if (clash) {
      return {
        ok: false,
        error:
          `The ${clash.dimensionLabel.toLowerCase()} you chose isn't available for this artwork any more. ` +
          'Please go back to the print options and pick a different one.',
      }
    }
  }

  // Limited editions use the chosen variant's price; open editions use the
  // single artwork price. Both are guaranteed non-null by the checks above.
  const artistCents = isLimited ? pinnedVariant!.priceCents! : artwork.printPriceCents!
  const galleryCents = Math.round(artistCents * TPS_GALLERY_MARKUP_RATE)

  const quote = getProviderQuote(providerId, {
    config: effectiveConfig,
    country: countryCode,
    artistPriceCents: artistCents,
  })

  // Provider Quote.lines layout: [{id:'artwork', amount}, {id:'shipping', amount}]
  // The 'artwork' line bundles artist + gallery + production cost
  // together; we split them out so callers can show the breakdown.
  const artworkLineCents = quote.lines.find((l) => l.id === 'artwork')?.amountCents ?? 0
  const shippingCents = quote.lines.find((l) => l.id === 'shipping')?.amountCents ?? 0
  const productionCents = Math.max(0, artworkLineCents - artistCents - galleryCents)
  // Per-item PRE-TAX is the artwork line ONLY — it must EXCLUDE shipping.
  // The provider's quote.subtotalCents = artworkLineCents + shippingCents
  // (see printspace getQuote), but for a multi-item order shipping is a
  // single consolidated parcel fee folded ONCE at the order level (the MAX
  // over items, not a sum). If we returned subtotalCents here, validateCart
  // would bake each item's shipping into the taxable base AND add the
  // consolidated line again — double-counting the parcel fee (and worse,
  // multiplying it by quantity). Returning the artwork line keeps this base
  // shipping-free so the caller adds shipping exactly once. The single-print
  // path computes VAT/total itself from its own quote.subtotalCents, so it
  // is unaffected by this change (it never consumes ItemPricing.preTaxCents).
  const preTaxCents = artworkLineCents
  const currency = quote.currency.toLowerCase()

  // Buyer-facing spec rows for the order summary written onto the Stripe
  // PaymentIntent (see createCartPaymentIntent). Cosmetic — never fail pricing
  // over a summary, so default to [] if it throws.
  let specsSummary: SpecsSummary = []
  try {
    specsSummary = summarizeConfig(catalog, effectiveConfig)
  } catch {
    // an order can be priced without a pretty summary
  }

  return {
    ok: true,
    effectiveConfig,
    artworkId: artwork.id,
    artistUserId: artwork.userId,
    title: artwork.title ?? artwork.slug,
    specsSummary,
    pricing: {
      artistCents,
      galleryCents,
      productionCents,
      shippingCents,
      preTaxCents,
      currency,
    },
  }
}
