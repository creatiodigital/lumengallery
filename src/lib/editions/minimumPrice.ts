/**
 * The cheapest a buyer can ACTUALLY complete a purchase of an artwork — the
 * number behind "starting at €X".
 *
 * Any figure shown on a listing has to be a price some real configuration
 * produces. The tempting shortcuts are not:
 *   - the artist's cut is what the ARTIST earns, not what a buyer pays
 *   - artist + gallery is a component of the price, and a loose lower bound:
 *     for `Landscape and River` it reads €140 against a genuine minimum of
 *     €311 — nobody can buy at €140, so advertising it fails at the first
 *     click.
 *
 * What this returns is the quote's ARTWORK LINE:
 *
 *     artist + gallery(40%) + print base(size) + COA/gallery letter
 *
 * excluding shipping and VAT, both of which depend on the buyer's destination
 * and so cannot be known on a listing. Excluding shipping is an ordinary shop
 * convention; excluding VAT is the part to keep an eye on, since EU B2C price
 * display generally expects the consumer-inclusive figure. Everything here is
 * cents, so multiplying by a VAT rate later is a one-line change — see
 * `withVat`.
 *
 * The minimum is derived per edition type because they are different shapes:
 *   - LIMITED: a closed set of variants, so the minimum is simply the cheapest
 *     one that is actually on sale. It rises on its own as cheaper variants
 *     sell out, and disappears (null) when none are purchasable — which is the
 *     signal to show "Sold".
 *   - OPEN: a continuous range, so the minimum is the smallest printable size,
 *     unframed. Framing, glass, mounts and hanging kits are all extras a buyer
 *     adds, and every one of them is zero on an unframed print.
 */
import { getPrintMinSize } from '@/lib/print-providers/printspace/sizeBounds'
import { TPS_PAPERS } from '@/lib/print-providers/printspace/data'
import { getProviderQuote } from '@/lib/print-providers/quote'
import type { ProviderId } from '@/lib/print-providers/types'
import type { WizardConfig } from '@/lib/print-providers/types'

import { variantToWizardConfig, type VariantConfigInput } from './variantToWizardConfig'

/** Where a minimum came from — useful for copy, admin and debugging. */
export type MinimumPrice = {
  /** Artwork line in cents: artist + gallery + print base + COA/letter. */
  cents: number
  /** Print size that produces it. */
  widthCm: number
  heightCm: number
} & ({ basis: 'variant'; variantName: string } | { basis: 'smallest-print' })

/** A limited variant that a buyer can actually reserve against. */
export type LiveVariant = VariantConfigInput & {
  name: string
  /** The artist's cut. A variant without one is not purchasable. */
  priceCents: number | null
}

const DEFAULT_PROVIDER: ProviderId = 'printspace'

/**
 * `getPrintBaseCents` interpolates on AREA alone — paper does not change the
 * price — so the reference paper here only has to be a valid id, and which one
 * cannot affect the result. Taken from the catalog rather than hardcoded so it
 * can't go stale if the first paper is ever swapped.
 */
const REFERENCE_PAPER = TPS_PAPERS[0]

/**
 * Quote with NO country, which is what makes the result destination-free: the
 * provider returns the artwork line alone, with no shipping and no tax.
 */
function artworkLineCents(config: WizardConfig, artistPriceCents: number, providerId: ProviderId) {
  return getProviderQuote(providerId, { config, country: '', artistPriceCents }).totalCents
}

/**
 * Cheapest ON-SALE variant of a limited edition. Null when none are
 * purchasable — an edition whose variants have all sold out, or one that has
 * not gone on sale yet. Callers show "Sold" for the former.
 *
 * Pass only variants that are live (`published && blocked`); this does not
 * re-check that, because what counts as live belongs with the query that
 * loaded them (see `LIVE_VARIANT_WHERE` in ./printable).
 */
export function minimumPriceForLimited(
  liveVariants: LiveVariant[],
  providerId: ProviderId = DEFAULT_PROVIDER,
): MinimumPrice | null {
  let best: MinimumPrice | null = null
  for (const v of liveVariants) {
    if (v.priceCents == null) continue
    const cents = artworkLineCents(variantToWizardConfig(v), v.priceCents, providerId)
    if (best === null || cents < best.cents) {
      best = {
        cents,
        widthCm: v.widthCm,
        heightCm: v.heightCm,
        basis: 'variant',
        variantName: v.name,
      }
    }
  }
  return best
}

/**
 * Cheapest configuration of an OPEN edition: the smallest printable size,
 * unframed, with no border. The smallest size is fixed by the file's
 * resolution — the short edge bottoms out at MIN_SHORT_EDGE_CM and the long
 * edge follows the artwork's aspect ratio, so it is per-artwork rather than a
 * fixed 20x20 (a square print would need a square image).
 *
 * Null when the artwork can't be priced: no artist price, or dimensions we
 * don't know, so no printable size can be derived.
 */
export function minimumPriceForOpen(
  artwork: {
    printPriceCents: number | null
    originalWidth: number | null
    originalHeight: number | null
  },
  providerId: ProviderId = DEFAULT_PROVIDER,
): MinimumPrice | null {
  const { printPriceCents, originalWidth, originalHeight } = artwork
  if (printPriceCents == null || !originalWidth || !originalHeight) return null

  const min = getPrintMinSize({ width: originalWidth, height: originalHeight })
  if (!min) return null

  const config: WizardConfig = {
    values: {
      printType: REFERENCE_PAPER.printType,
      paper: REFERENCE_PAPER.id,
      // Print-only zeroes the frame, glass, hanging and mount supplements —
      // every one of those is something the buyer opts into.
      format: 'print-only',
    },
    customSize: { widthCm: min.widthCm, heightCm: min.heightCm },
    borders: { border: { allCm: 0 } },
  }

  return {
    cents: artworkLineCents(config, printPriceCents, providerId),
    widthCm: min.widthCm,
    heightCm: min.heightCm,
    basis: 'smallest-print',
  }
}

/**
 * Minimum for either edition type. `liveVariants` is ignored for an open
 * edition and required for a limited one.
 */
export function minimumPriceForArtwork(
  artwork: {
    editionType: string
    printEnabled: boolean
    printPriceCents: number | null
    originalWidth: number | null
    originalHeight: number | null
  },
  liveVariants: LiveVariant[] = [],
  providerId: ProviderId = DEFAULT_PROVIDER,
): MinimumPrice | null {
  if (!artwork.printEnabled) return null
  return artwork.editionType === 'limited'
    ? minimumPriceForLimited(liveVariants, providerId)
    : minimumPriceForOpen(artwork, providerId)
}

/**
 * Same figure with VAT applied, for if the display ever needs to be
 * consumer-inclusive. Kept separate so the stored/base number stays one thing
 * and the presentation choice stays another.
 */
export function withVat(cents: number, vatRate: number): number {
  return Math.round(cents * (1 + vatRate))
}
