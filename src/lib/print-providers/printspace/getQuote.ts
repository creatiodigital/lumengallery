import type { GetQuoteInput, Quote, QuoteLine } from '../types'
import { getMountPresetWidthCm } from './data'
import type { TpsFrameTypeId, TpsGlassId, TpsHangingId } from './data'
import {
  TPS_COA_LETTER_SUPPLEMENT_CENTS,
  TPS_FREE_PRINT_DELIVERY_FROM_CENTS,
  TPS_GALLERY_MARKUP_RATE,
  TPS_HANGING_SUPPLEMENT_CENTS,
  getFrameShippingCents,
  getFrameSupplementCents,
  getGlassSupplementCents,
  getMountBoardSupplementCents,
  getPrintBaseCents,
  getPrintShippingCents,
  getVatRate,
} from './pricing'

/**
 * The Print Space quote — composed from approximate hardcoded tables
 * (see ./pricing.ts). TPS doesn't expose live prices via API; the
 * gallery accepts a small variance and rounds slightly upward so the
 * delta always lands in the gallery's favour, never the buyer's.
 *
 * `country` is optional. When the buyer hasn't picked one yet (wizard
 * step 1) we return only the artwork line — no shipping, no tax. The
 * checkout step calls this again with a country to fold those in.
 *
 * Composition:
 *   subtotal = artist + gallery markup + print base + frame + glass + hanging [+ shipping]
 *   tax      = 21% on subtotal when shipping to an EU country
 *   total    = subtotal + tax
 */
export function getPrintspaceQuote(input: GetQuoteInput): Quote {
  const { config, country, artistPriceCents } = input

  // Effective size — TPS sells custom sizes only, but `customSize`
  // may be absent on a brand-new wizard render. Fall back to a
  // sensible default so we always return a quote shape rather than
  // throwing.
  const widthCm = config.customSize?.widthCm ?? 21
  const heightCm = config.customSize?.heightCm ?? 30
  const hasCountry = !!country

  const formatId = config.values.format
  const isFramed = formatId === 'framing'
  const frameTypeId = config.values.frameType as TpsFrameTypeId | undefined
  const glassId = (config.values.glass as TpsGlassId | undefined) ?? 'none'
  const hangingId = (config.values.hanging as TpsHangingId | undefined) ?? 'none'

  // Print base — same approximate per-tier number across paper /
  // print-type variants. Bias upward so paper variance never
  // underprices.
  const printBaseCents = getPrintBaseCents(widthCm, heightCm)

  // Frame supplement — only when framed; depends on frame type.
  const frameSupplementCents =
    isFramed && frameTypeId ? getFrameSupplementCents(frameTypeId, widthCm, heightCm) : 0

  // Glass — Anti Reflective scales with frame size (None / Standard
  // are bundled free). Only relevant when framed.
  const glassCents = isFramed ? getGlassSupplementCents(glassId, widthCm, heightCm) : 0
  // Hanging — flat per option, all currently €0.
  const hangingCents = isFramed ? (TPS_HANGING_SUPPLEMENT_CENTS[hangingId] ?? 0) : 0
  // Window mount (passepartout) — active when a non-'none' color is
  // picked. Width comes from the Small/Large preset scaled to the
  // print size; legacy configs (pre-2026-07) may still carry an
  // explicit slider width in `borders`, honored as stored.
  const mountId = config.values.windowMount as string | undefined
  const hasMount = isFramed && !!mountId && mountId !== 'none'
  const mountPreset = config.values.windowMountSize as string | undefined
  const legacyMountCm = config.borders?.['windowMountSize']?.allCm
  const mountWidthCm = hasMount
    ? mountPreset || legacyMountCm === undefined
      ? getMountPresetWidthCm(mountPreset, widthCm, heightCm)
      : legacyMountCm
    : 0
  const mountCents = hasMount
    ? getMountBoardSupplementCents(mountWidthCm, Math.max(widthCm, heightCm))
    : 0

  // Gallery markup on the artist's price.
  const galleryCents = Math.round(artistPriceCents * TPS_GALLERY_MARKUP_RATE)

  // Wizard summary lumps artwork + production into a single "Artwork"
  // line and shows shipping separately when a destination is set.
  const artworkLineCents =
    artistPriceCents +
    galleryCents +
    printBaseCents +
    // Every print ships with the COA + gallery letter (2026-07-24).
    TPS_COA_LETTER_SUPPLEMENT_CENTS +
    frameSupplementCents +
    glassCents +
    hangingCents +
    mountCents

  const lines: QuoteLine[] = [{ id: 'artwork', label: 'Artwork', amountCents: artworkLineCents }]

  if (!hasCountry) {
    return {
      currency: 'EUR',
      lines,
      subtotalCents: artworkLineCents,
      taxCents: 0,
      totalCents: artworkLineCents,
    }
  }

  // Shipping — banded by parcel size (per-frame when framed; the
  // frame picker estimates outer dims from print size + mount).
  // High-value print-only orders ship free from TPS — passed on.
  const freeDelivery = !isFramed && printBaseCents >= TPS_FREE_PRINT_DELIVERY_FROM_CENTS
  const shippingCents = freeDelivery
    ? 0
    : isFramed
      ? getFrameShippingCents(country, widthCm, heightCm, mountWidthCm)
      : getPrintShippingCents(country, widthCm, heightCm)
  lines.push({ id: 'shipping', label: 'Shipping', amountCents: shippingCents, muted: true })

  const subtotalCents = artworkLineCents + shippingCents
  const vatRate = getVatRate(country)
  const taxCents = Math.round(subtotalCents * vatRate)
  const totalCents = subtotalCents + taxCents

  // Format the rate as a percentage with up to 1 decimal so 19% / 25.5%
  // both render cleanly. Country code stays in the label so the buyer
  // sees which jurisdiction the rate is for.
  const ratePercent = vatRate * 100
  const rateText = Number.isInteger(ratePercent) ? `${ratePercent}%` : `${ratePercent.toFixed(1)}%`

  return {
    currency: 'EUR',
    lines,
    subtotalCents,
    taxCents,
    taxLabel: vatRate > 0 ? `VAT (ES ${rateText})` : undefined,
    totalCents,
  }
}
