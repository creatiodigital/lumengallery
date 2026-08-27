import prisma from '@/lib/prisma'

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
  /** The copy the buyer would receive. `null` when none are left. */
  nextNumber: number | null
}

/** `Edition 50x40 Baryta 1 of 30`, or `Edition 70x60 Baryta Sold out`. */
export function formatVariantEditionLine(line: VariantEditionLine): string {
  const suffix =
    line.nextNumber === null ? 'Sold out' : `${line.nextNumber} of ${line.editionSize}`
  return `Edition ${line.variantName} ${suffix}`
}

/**
 * One line per live variant, in the order the variants are shown.
 *
 * `nextNumber` is the LOWEST still-available copy, not `max(sold) + 1`. A
 * cancelled order returns its number to the pool, so the two diverge — and only
 * the minimum available is the number `reserveEditionNumber` will actually hand
 * out. Taking the first row of an ascending ordered fetch gets it in one query.
 */
export async function getVariantEditionLines(artworkId: string): Promise<VariantEditionLine[]> {
  const variants = await prisma.limitedVariant.findMany({
    where: { artworkId, ...LIVE_VARIANT_WHERE },
    orderBy: { editionSize: 'desc' },
    select: {
      name: true,
      editionSize: true,
      editionNumbers: {
        where: { state: 'available' },
        orderBy: { number: 'asc' },
        take: 1,
        select: { number: true },
      },
    },
  })

  return variants.map((v) => ({
    variantName: v.name,
    editionSize: v.editionSize,
    nextNumber: v.editionNumbers[0]?.number ?? null,
  }))
}
