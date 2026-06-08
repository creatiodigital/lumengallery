import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * Limited-edition fixture helpers. Rather than mutate the shared OPEN
 * fixture artwork (which other specs read in parallel), these create a
 * DEDICATED throwaway limited artwork — owned by the same fixture artist —
 * publish one variant with materialised edition numbers, run the spec,
 * then delete it. Self-contained, so there's no cross-file interference.
 *
 * Cleanup is best-effort (logs, never throws) so it's safe in `finally`.
 */

export type LimitedFixture = {
  artworkId: string
  slug: string
  variantId: string
  editionSize: number
  widthCm: number
  heightCm: number
  artistPriceCents: number
}

/**
 * Create a published limited-edition artwork with a single variant of
 * `editionSize` numbers. Copies the fixture artwork's artist, pixel size
 * and price so the variant quotes and ships like a real print.
 */
export async function setupLimitedFixture(editionSize = 5): Promise<LimitedFixture> {
  const base = await prisma.artwork.findUnique({
    where: { slug: fixtures.artworkSlug },
    select: {
      userId: true,
      originalWidth: true,
      originalHeight: true,
      printPriceCents: true,
    },
  })
  if (!base) throw new Error(`Fixture artwork "${fixtures.artworkSlug}" not found — check dev DB`)

  const wPx = base.originalWidth ?? 4000
  const hPx = base.originalHeight ?? 3000
  const artistPriceCents = base.printPriceCents ?? 10000

  // Long edge 40 cm, short edge derived from the artwork's real ratio.
  const longCm = 40
  const shortCm = Math.round(((longCm * Math.min(wPx, hPx)) / Math.max(wPx, hPx)) * 10) / 10
  const widthCm = wPx >= hPx ? longCm : shortCm
  const heightCm = wPx >= hPx ? shortCm : longCm

  const slug = `e2e-limited-${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}`

  const artwork = await prisma.artwork.create({
    data: {
      name: 'E2E Limited Edition',
      slug,
      title: 'E2E Limited Edition',
      userId: base.userId,
      originalWidth: wPx,
      originalHeight: hPx,
      printEnabled: true,
      printPriceCents: artistPriceCents,
      editionType: 'limited',
      editionLocked: true,
    },
    select: { id: true },
  })

  const variant = await prisma.limitedVariant.create({
    data: {
      artworkId: artwork.id,
      name: 'E2E Small',
      paperId: 'hahnemuhle-german-etching',
      printTypeId: 'giclee',
      widthCm,
      heightCm,
      borderCm: 3,
      editionSize,
      published: true,
      order: 0,
    },
  })

  await prisma.editionNumber.createMany({
    data: Array.from({ length: editionSize }, (_, i) => ({ variantId: variant.id, number: i + 1 })),
    skipDuplicates: true,
  })

  return {
    artworkId: artwork.id,
    slug,
    variantId: variant.id,
    editionSize,
    widthCm,
    heightCm,
    artistPriceCents,
  }
}

/** Delete the throwaway artwork — cascades its variant + edition numbers. */
export async function teardownLimitedFixture(fixture: LimitedFixture): Promise<void> {
  try {
    await prisma.artwork.deleteMany({ where: { id: fixture.artworkId } })
  } catch (err) {
    console.warn(
      `[e2e cleanup] teardown limited fixture ${fixture.slug} failed:`,
      err instanceof Error ? err.message : err,
    )
  }
}

/** Current state of a variant's edition numbers, for assertions. */
export async function editionNumberStates(
  variantId: string,
): Promise<{ number: number; state: string; paymentIntentId: string | null }[]> {
  return prisma.editionNumber.findMany({
    where: { variantId },
    select: { number: true, state: true, paymentIntentId: true },
    orderBy: { number: 'asc' },
  })
}
