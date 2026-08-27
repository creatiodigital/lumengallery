import prisma from '@/lib/prisma'

import { formatDisplayPrice } from './formatDisplayPrice'
import { minimumPriceForLimited } from './minimumPrice'
import { LIVE_VARIANT_WHERE } from './printable'

/**
 * The edition lines shown on an artwork page — one per live variant.
 *
 * A single photograph is several editions: `editionSize` lives on the VARIANT,
 * not the artwork, so "50x40 Baryta" and "70x60 Baryta" of the same image can be
 * editions of 30 and 10 respectively, each numbered independently.
 *
 * The number shown is the copy the buyer is ABOUT TO GET, so the line reads
 * forward — "this one becomes yours" — instead of reporting how many have
 * already gone.
 *
 * Two visitors can be shown the same number at once and whoever pays first takes
 * it. That is deliberate: editions are NOT reserved before payment, and the
 * card's "not reserved until you pay" sentence is the whole mitigation. It is
 * not a reason to reintroduce holds.
 */
export type VariantEditionLine = {
  /** The variant's own free-text name, which already encodes size and paper. */
  variantName: string
  /** This variant's edition size — never the artwork's. */
  editionSize: number
  /** True once every copy has sold. The only per-variant state the row shows —
   *  a count is deliberately absent, see below. */
  soldOut: boolean
  /** What this edition costs, excluding shipping and tax. Price is NOT common
   *  across a work's editions — each variant is its own size, paper and figure —
   *  so it belongs on the row, never as one number above them all. */
  priceCents: number | null
}

/**
 * A line split into its parts, so a surface can lay them out as columns and set
 * the variant's name apart — it is the part a reader scans for, and the only
 * part that differs between rows.
 */
export type VariantEditionLineParts = {
  /** The variant's own name, e.g. "50x40 Baryta". */
  name: string
  /** "Edition of 50", or "Sold out" once every copy has gone. */
  count: string
  /** "€312", or null when the variant carries no usable price. */
  price: string | null
}

export function variantEditionLineParts(line: VariantEditionLine): VariantEditionLineParts {
  return {
    name: line.variantName,
    count: line.soldOut ? 'Sold out' : `Edition of ${line.editionSize}`,
    price: line.priceCents === null ? null : formatDisplayPrice(line.priceCents),
  }
}

/**
 * One line per live variant: its name and its edition SIZE. No running count.
 *
 * Three counts were tried on this row and every one misled:
 *
 *   lowest AVAILABLE — a number is reserved the moment a PaymentIntent exists,
 *     so an abandoned checkout consumed one and a live edition advanced from
 *     "2 of 50" to "4 of 50" with nothing sold.
 *   max(sold) + 1 — reads as a promise of a particular copy, which nobody can
 *     make: the copy is decided when payment confirms, and someone else may pay
 *     first.
 *   max(sold) — accurate, but "6 of 50" is the EDITION-NUMBER convention. Every
 *     collector reads it as "this is copy 6", so the truest number was also the
 *     most misleading thing on the page.
 *
 * `X of Y` wants to mean an edition number. Since this row cannot honestly show
 * one, it shows the edition size instead and says nothing it cannot stand
 * behind. The buyer learns their own number when production starts.
 */
export async function getVariantEditionLines(artworkId: string): Promise<VariantEditionLine[]> {
  const variants = await prisma.limitedVariant.findMany({
    where: { artworkId, ...LIVE_VARIANT_WHERE },
    orderBy: { editionSize: 'desc' },
    select: {
      name: true,
      editionSize: true,
      priceCents: true,
      paperId: true,
      printTypeId: true,
      widthCm: true,
      heightCm: true,
      borderCm: true,
      sheetWidthCm: true,
      sheetHeightCm: true,
      // Sold copies only. A reserved one belongs to an unfinished checkout and
      // counts for nothing — only the Stripe webhook sets `sold`, so it is the
      // single state that means money arrived.
      _count: { select: { editionNumbers: { where: { state: 'sold' } } } },
    },
  })

  return variants.map((v) => ({
    variantName: v.name,
    editionSize: v.editionSize,
    // Every copy gone. Counted rather than compared against the highest number
    // sold, which a gap in the ledger would make wrong.
    soldOut: v._count.editionNumbers >= v.editionSize,
    // Priced by handing this variant ALONE to the same function that picks the
    // cheapest across all of them. Same arithmetic, so a row's figure and the
    // card's minimum cannot drift apart.
    priceCents: minimumPriceForLimited([v])?.cents ?? null,
  }))
}
