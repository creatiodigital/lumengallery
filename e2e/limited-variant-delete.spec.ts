import { test, expect } from '@playwright/test'

import { deleteLimitedVariant } from '@/lib/editions/deleteLimitedVariant'
import { saveLimitedVariants } from '@/lib/editions/saveLimitedVariants'
import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * Guards for the immediate per-variant delete (the DELETE
 * `/api/artworks/[id]/variants/[variantId]` route calls straight into this).
 *
 * Deleting used to be a LOCAL edit that only reached the database when the
 * artist saved the whole artwork form — so a delete followed by a reload
 * silently came back. Now the button deletes on confirm, which means every
 * rule `saveLimitedVariants` enforced on its delete path has to be enforced
 * here too, at the moment of the click:
 *   - a live variant (published + blocked) is never deletable
 *   - a variant holding a reserved/sold number is never deletable, even
 *     unblocked — that number is a real sale
 *   - a limited edition can't be left with zero variants
 *   - the artwork's series-type lock follows the last LIVE variant out
 *
 * Calls the helper directly (no browser): the route handler adds only auth.
 * Fixtures are throwaway artworks, deleted per test.
 */

/** Add a second variant so the "last variant" guard isn't what's under test. */
async function addSibling(artworkId: string, name: string, published = false) {
  return prisma.limitedVariant.create({
    data: {
      artworkId,
      name,
      paperId: 'hahnemuhle-german-etching',
      printTypeId: 'giclee',
      widthCm: 20,
      heightCm: 15,
      borderCm: 3,
      editionSize: 5,
      priceCents: 12000,
      published,
      blocked: published,
      order: 1,
    },
    select: { id: true },
  })
}

test.describe('deleteLimitedVariant', () => {
  test('deletes a draft variant and takes its edition numbers with it', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      const draft = await addSibling(fx.artworkId, 'E2E Draft')
      await prisma.editionNumber.createMany({
        data: [1, 2, 3].map((n) => ({ variantId: draft.id, number: n })),
        skipDuplicates: true,
      })

      const res = await deleteLimitedVariant({ artworkId: fx.artworkId, variantId: draft.id })
      expect(res.ok).toBe(true)

      expect(await prisma.limitedVariant.count({ where: { id: draft.id } })).toBe(0)
      expect(await prisma.editionNumber.count({ where: { variantId: draft.id } })).toBe(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('refuses a live variant (published and blocked)', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      await addSibling(fx.artworkId, 'E2E Draft')

      // The fixture's own variant is published + blocked = on sale.
      const res = await deleteLimitedVariant({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/on sale/i)
      expect(await prisma.limitedVariant.count({ where: { id: fx.variantId } })).toBe(1)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('refuses an unblocked variant that already has a reserved or sold number', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      await addSibling(fx.artworkId, 'E2E Draft')
      // Admin took it off sale to edit — but copy 1 is already sold.
      await prisma.limitedVariant.update({
        where: { id: fx.variantId },
        data: { blocked: false },
      })
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 1 },
        data: { state: 'sold', soldAt: new Date() },
      })

      const res = await deleteLimitedVariant({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/sold or reserved/i)
      expect(await prisma.limitedVariant.count({ where: { id: fx.variantId } })).toBe(1)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('allows an unblocked variant whose numbers are all still available', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      await addSibling(fx.artworkId, 'E2E Draft')
      await prisma.limitedVariant.update({
        where: { id: fx.variantId },
        data: { blocked: false },
      })

      const res = await deleteLimitedVariant({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
      })
      expect(res.ok).toBe(true)
      expect(await prisma.editionNumber.count({ where: { variantId: fx.variantId } })).toBe(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('refuses to delete the last remaining variant', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      await prisma.limitedVariant.update({
        where: { id: fx.variantId },
        data: { published: false, blocked: false },
      })

      const res = await deleteLimitedVariant({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/at least one/i)
      expect(await prisma.limitedVariant.count({ where: { id: fx.variantId } })).toBe(1)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('refuses a variant that belongs to a different artwork', async () => {
    const a = await setupLimitedFixture(3)
    const b = await setupLimitedFixture(3)
    try {
      await addSibling(b.artworkId, 'E2E Draft')
      const res = await deleteLimitedVariant({ artworkId: a.artworkId, variantId: b.variantId })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/not found/i)
      expect(await prisma.limitedVariant.count({ where: { id: b.variantId } })).toBe(1)
    } finally {
      await teardownLimitedFixture(a)
      await teardownLimitedFixture(b)
    }
  })

  test('releases the series-type lock when the last live variant is deleted', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      // One live variant (the fixture's) + one draft. Deleting the DRAFT
      // leaves a live one, so the lock must stay on.
      const draft = await addSibling(fx.artworkId, 'E2E Draft')
      await deleteLimitedVariant({ artworkId: fx.artworkId, variantId: draft.id })
      let art = await prisma.artwork.findUnique({
        where: { id: fx.artworkId },
        select: { editionLocked: true },
      })
      expect(art?.editionLocked).toBe(true)

      // Now unblock + delete the live one, with a draft left behind to
      // satisfy the "at least one variant" rule. No live variant remains,
      // so the open/limited radio must unlock.
      await addSibling(fx.artworkId, 'E2E Draft 2')
      await prisma.limitedVariant.update({
        where: { id: fx.variantId },
        data: { blocked: false },
      })
      const res = await deleteLimitedVariant({
        artworkId: fx.artworkId,
        variantId: fx.variantId,
      })
      expect(res.ok).toBe(true)

      art = await prisma.artwork.findUnique({
        where: { id: fx.artworkId },
        select: { editionLocked: true },
      })
      expect(art?.editionLocked).toBe(false)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})

/**
 * Renaming a variant that is already on sale.
 *
 * The name is a LABEL, not part of the variant's identity: no invoice
 * references it (`buildInvoiceLines` / `buildInvoiceSnapshots` never read it),
 * buyer emails bake it in at order-creation time, and every other surface —
 * the edition-sales ledger, gift orders, the buyer's variant picker, admin
 * order rows — joins it live. So a rename propagates everywhere and rewrites
 * no record. Size, sheet, paper, border and edition size are the real
 * identity and must STAY frozen while copies are selling.
 */
test.describe('renaming a live variant', () => {
  const artworkPixels = { widthPx: 4773, heightPx: 6842 }

  test('a live variant can be renamed, even with a sold copy', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      // Sell copy 1 — the strongest form of "this edition is in the world".
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 1 },
        data: { state: 'sold', soldAt: new Date() },
      })

      const res = await saveLimitedVariants({
        artworkId: fx.artworkId,
        artworkPixels,
        variants: [
          {
            id: fx.variantId,
            name: 'Renamed While Selling',
            paperId: 'hahnemuhle-german-etching',
            widthCm: fx.widthCm,
            heightCm: fx.heightCm,
            borderCm: 3,
            editionSize: fx.editionSize,
            priceCents: fx.artistPriceCents,
          },
        ],
      })
      expect(res.ok, res.ok ? '' : res.error).toBe(true)

      const after = await prisma.limitedVariant.findUnique({
        where: { id: fx.variantId },
        select: { name: true, editionSize: true, widthCm: true },
      })
      expect(after?.name).toBe('Renamed While Selling')
      // The rename must not have disturbed the frozen fields or the ledger.
      expect(after?.editionSize).toBe(fx.editionSize)
      expect(
        await prisma.editionNumber.count({ where: { variantId: fx.variantId, state: 'sold' } }),
        'the sold copy stays sold',
      ).toBe(1)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('renaming does NOT open the door to changing the edition size', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      const res = await saveLimitedVariants({
        artworkId: fx.artworkId,
        artworkPixels,
        variants: [
          {
            id: fx.variantId,
            name: 'Renamed And Resized',
            paperId: 'hahnemuhle-german-etching',
            widthCm: fx.widthCm,
            heightCm: fx.heightCm,
            borderCm: 3,
            editionSize: fx.editionSize + 25, // frozen — must be refused
            priceCents: fx.artistPriceCents,
          },
        ],
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/name and price/i)

      const after = await prisma.limitedVariant.findUnique({
        where: { id: fx.variantId },
        select: { name: true, editionSize: true },
      })
      expect(after?.name, 'a rejected save must not half-apply the rename').toBe('E2E Small')
      expect(after?.editionSize).toBe(fx.editionSize)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a live variant still cannot be renamed to nothing', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      const res = await saveLimitedVariants({
        artworkId: fx.artworkId,
        artworkPixels,
        variants: [
          {
            id: fx.variantId,
            name: '   ',
            paperId: 'hahnemuhle-german-etching',
            widthCm: fx.widthCm,
            heightCm: fx.heightCm,
            borderCm: 3,
            editionSize: fx.editionSize,
            priceCents: fx.artistPriceCents,
          },
        ],
      })
      expect(res.ok).toBe(false)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
