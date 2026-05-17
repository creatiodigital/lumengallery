'use server'

import type { GetQuoteInput, Quote, QuoteLine } from '../types'
import type { TpsFrameTypeId, TpsGlassId, TpsHangingId } from './data'
import {
  TPS_GALLERY_MARKUP_RATE,
  TPS_HANGING_SUPPLEMENT_CENTS,
  TPS_SHIPPING_PRINTS_CENTS,
  getFrameShippingCents,
  getFrameSupplementCents,
  getGlassSupplementCents,
  getMountBoardSupplementCents,
  getPrintBaseCents,
  getVatRate,
  resolveTpsRegion,
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
export async function getPrintspaceQuote(input: GetQuoteInput): Promise<Quote> {
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
  // Window mount (passepartout) — proportional to mount width when
  // a non-'none' colour is picked AND the buyer has set a width.
  const mountId = config.values.windowMount as string | undefined
  const mountWidthCm = config.borders?.['windowMountSize']?.allCm ?? 0
  const mountCents =
    isFramed && mountId && mountId !== 'none' ? getMountBoardSupplementCents(mountWidthCm) : 0

  // Gallery markup on the artist's price.
  const galleryCents = Math.round(artistPriceCents * TPS_GALLERY_MARKUP_RATE)

  // Wizard summary lumps artwork + production into a single "Artwork"
  // line and shows shipping separately when a destination is set.
  const artworkLineCents =
    artistPriceCents +
    galleryCents +
    printBaseCents +
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

  // Shipping — flat per-print rate when not framed; tiered per-frame
  // rate when framed (long-edge cm).
  const region = resolveTpsRegion(country)
  const shippingCents = isFramed
    ? getFrameShippingCents(region, widthCm, heightCm)
    : TPS_SHIPPING_PRINTS_CENTS[region]
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
    taxLabel: vatRate > 0 ? `VAT (${country.toUpperCase()} ${rateText})` : undefined,
    totalCents,
  }
}
