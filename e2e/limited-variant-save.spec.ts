import { test, expect } from '@playwright/test'

import { saveLimitedVariants } from '@/lib/editions/saveLimitedVariants'
import { updateVariantNameAndPrice } from '@/lib/editions/updateVariantNameAndPrice'
import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * Saving ONE variant's name + price on its own (the "Save name & price" button,
 * PATCH `/api/artworks/[id]/variants/[variantId]`).
 *
 * Two reasons this exists rather than routing through the artwork save:
 *   1. an artist shouldn't scroll to the bottom of the form and save
 *      everything just to raise one price;
 *   2. the whole-artwork save re-validates EVERY variant's geometry, so one
 *      drifted variant (an image replaced with a differently-proportioned
 *      file) makes the entire artwork unsavable — including healthy variants'
 *      prices. That happened on `high-res-80234` on 2026-08-21.
 *
 * The narrowness is the safety: only name and price are accepted here. Size,
 * sheet, paper, border and edition size still go through the artwork save,
 * where the geometry rules and the on-sale freeze apply.
 */
test.describe('updateVariantNameAndPrice', () => {
  test('saves name and price on a variant that is on sale with a sold copy', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 1 },
        data: { state: 'sold', soldAt: new Date() },
      })

      const res = await updateVariantNameAndPrice({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
        name: 'Renamed In Place',
        priceCents: 42000,
      })
      expect(res.ok, res.ok ? '' : res.error).toBe(true)

      const after = await prisma.limitedVariant.findUnique({
        where: { id: fx.variantId },
        select: { name: true, priceCents: true, widthCm: true, editionSize: true, blocked: true },
      })
      expect(after?.name).toBe('Renamed In Place')
      expect(after?.priceCents).toBe(42000)
      // Nothing physical moved, and the variant is still on sale.
      expect(after?.widthCm).toBe(fx.widthCm)
      expect(after?.editionSize).toBe(fx.editionSize)
      expect(after?.blocked).toBe(true)
      expect(
        await prisma.editionNumber.count({ where: { variantId: fx.variantId, state: 'sold' } }),
      ).toBe(1)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  /**
   * THE reason this endpoint exists. Reproduces `high-res-80234`: the artwork's
   * pixel dimensions no longer match the variant's stored print size, so the
   * whole-artwork save fails aspect-ratio validation and the artist cannot
   * change ANYTHING. The per-variant save must still work.
   */
  test('works even when the artwork geometry no longer validates', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      // Simulate the image being replaced with a differently-proportioned file:
      // squash the stored pixel height so the variant's ratio drifts well past
      // the 2% aspect tolerance.
      const art = await prisma.artwork.findUnique({
        where: { id: fx.artworkId },
        select: { originalWidth: true, originalHeight: true },
      })
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { originalHeight: Math.round((art!.originalHeight as number) * 0.85) },
      })

      // The whole-artwork save is now blocked — this is the wall the artist hit.
      const viaArtwork = await saveLimitedVariants({
        artworkId: fx.artworkId,
        artworkPixels: {
          widthPx: art!.originalWidth as number,
          heightPx: Math.round((art!.originalHeight as number) * 0.85),
        },
        variants: [
          {
            id: fx.variantId,
            name: 'Blocked By Geometry',
            paperId: 'hahnemuhle-german-etching',
            widthCm: fx.widthCm,
            heightCm: fx.heightCm,
            borderCm: 3,
            editionSize: fx.editionSize,
            priceCents: 42000,
          },
        ],
      })
      expect(viaArtwork.ok, 'the whole-artwork save should be blocked here').toBe(false)
      if (!viaArtwork.ok) expect(viaArtwork.error).toMatch(/aspect ratio/i)

      // The per-variant save goes through anyway — it never looks at geometry.
      const res = await updateVariantNameAndPrice({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
        name: 'Saved Anyway',
        priceCents: 42000,
      })
      expect(res.ok, res.ok ? '' : res.error).toBe(true)

      const after = await prisma.limitedVariant.findUnique({
        where: { id: fx.variantId },
        select: { name: true, priceCents: true },
      })
      expect(after?.name).toBe('Saved Anyway')
      expect(after?.priceCents).toBe(42000)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('refuses an empty name', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      const res = await updateVariantNameAndPrice({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
        name: '   ',
        priceCents: 42000,
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/needs a name/i)
      const after = await prisma.limitedVariant.findUnique({
        where: { id: fx.variantId },
        select: { name: true },
      })
      expect(after?.name, 'a rejected save must not half-apply').toBe('E2E Small')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('refuses a zero or negative price', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      for (const priceCents of [0, -100]) {
        const res = await updateVariantNameAndPrice({
          artworkId: fx.artworkId,
          variantId: fx.variantId,
          name: 'Free Print',
          priceCents,
        })
        expect(res.ok, `price ${priceCents} must be refused`).toBe(false)
      }
      const after = await prisma.limitedVariant.findUnique({
        where: { id: fx.variantId },
        select: { priceCents: true, name: true },
      })
      expect(after?.priceCents).toBe(fx.artistPriceCents)
      expect(after?.name).toBe('E2E Small')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('refuses a variant belonging to a different artwork', async () => {
    const a = await setupLimitedFixture(3)
    const b = await setupLimitedFixture(3)
    try {
      const res = await updateVariantNameAndPrice({
        artworkId: a.artworkId,
        variantId: b.variantId,
        name: 'Cross Artwork',
        priceCents: 42000,
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/not found/i)
      const after = await prisma.limitedVariant.findUnique({
        where: { id: b.variantId },
        select: { name: true },
      })
      expect(after?.name).toBe('E2E Small')
    } finally {
      await teardownLimitedFixture(a)
      await teardownLimitedFixture(b)
    }
  })

  test('refuses a price that does not cover a fixed sheet’s production cost', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      // A sheet much larger than the image: the gallery absorbs the extra paper.
      await prisma.limitedVariant.update({
        where: { id: fx.variantId },
        data: {
          sheetWidthCm: fx.widthCm * 2,
          sheetHeightCm: fx.heightCm * 2,
        },
      })

      const res = await updateVariantNameAndPrice({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
        name: 'Too Cheap',
        priceCents: 100, // €1 — cannot possibly cover the surrounding paper
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/production|raise the price/i)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
