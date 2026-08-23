import { test, expect } from '@playwright/test'

import { getPrintsCatalogPage } from '@/app/prints/actions'
import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * A limited edition has NO artwork-level price — it is priced per variant.
 *
 * The catalog used to gate on `printPriceCents: { not: null }`, the OPEN-edition
 * artwork price, which silently hid every limited edition that had never
 * carried a leftover artwork-level price: priced, live, purchasable at its own
 * URL, and absent from the shop (reported 2026-08-21 — three of five selling
 * artworks were missing from /prints).
 *
 * The catalog and the checkout must agree. `validateAndPriceItem` is the
 * authority on what a buyer can pay for; these assert the catalog shows exactly
 * that set. Anything the catalog hides is unsellable in practice, and anything
 * it shows that checkout would refuse is a dead end for a buyer.
 *
 * Calls the server action directly — no browser, no WebGL.
 */

async function itemsInCatalog(edition?: 'open' | 'limited') {
  // Page size is bounded, so page through rather than assume one page holds
  // the fixture. Small dataset; a couple of round-trips is fine.
  const seen: Awaited<ReturnType<typeof getPrintsCatalogPage>>['items'] = []
  for (let page = 1; page <= 10; page++) {
    const { items, totalCount } = await getPrintsCatalogPage({ page, edition: edition ?? '' })
    seen.push(...items)
    if (seen.length >= totalCount || items.length === 0) break
  }
  return seen
}

async function titlesInCatalog(edition?: 'open' | 'limited') {
  return (await itemsInCatalog(edition)).map((i) => i.title ?? i.name ?? '')
}

/** The one catalog card for `title`, or null if the work isn't listed. */
async function cardFor(title: string) {
  return (await itemsInCatalog()).find((i) => (i.title ?? i.name) === title) ?? null
}

/** Mark every one of a variant's numbers as taken, so nothing is left to buy. */
async function sellOut(variantId: string, state: 'sold' | 'reserved' = 'sold') {
  await prisma.editionNumber.updateMany({ where: { variantId }, data: { state } })
}

test.describe('prints catalog — limited editions', () => {
  test('a limited edition with NO artwork price but a live priced variant is listed', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      // The real-world shape: priced per variant, no artwork-level price.
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: null, title: `E2E Limited NoArtworkPrice ${fx.slug}` },
      })

      const titles = await titlesInCatalog()
      expect(
        titles,
        'a live, per-variant-priced limited edition must appear in the shop',
      ).toContain(`E2E Limited NoArtworkPrice ${fx.slug}`)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('it disappears once its only variant is taken off sale', async () => {
    const fx = await setupLimitedFixture(3)
    const title = `E2E Limited Paused ${fx.slug}`
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: null, title },
      })
      expect(await titlesInCatalog()).toContain(title)

      // Unblocked = paused from sale; reservations are refused, so the catalog
      // must not keep offering it.
      await prisma.limitedVariant.update({
        where: { id: fx.variantId },
        data: { blocked: false },
      })
      expect(
        await titlesInCatalog(),
        'a paused edition must leave the catalog, not linger',
      ).not.toContain(title)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a limited edition whose variant has no price is not listed', async () => {
    const fx = await setupLimitedFixture(3)
    const title = `E2E Limited Unpriced ${fx.slug}`
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: null, title },
      })
      await prisma.limitedVariant.update({
        where: { id: fx.variantId },
        data: { priceCents: null },
      })
      expect(await titlesInCatalog()).not.toContain(title)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('an OPEN edition still requires the artwork-level price', async () => {
    const fx = await setupLimitedFixture(3)
    const title = `E2E Open Unpriced ${fx.slug}`
    try {
      // Open editions are priced on the artwork; without that price there is
      // nothing to charge, so the fix must not have loosened this.
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { editionType: 'open', printPriceCents: null, title },
      })
      expect(await titlesInCatalog()).not.toContain(title)

      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: 25000 },
      })
      expect(await titlesInCatalog()).toContain(title)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  /**
   * SOLD OUT — the gap between "purchasable" and "in stock".
   *
   * LIVE_VARIANT_WHERE says published + blocked + priced. It says nothing about
   * remaining stock, so a variant whose every copy is gone still matched, and
   * minimumPriceForLimited happily priced it. The catalogue therefore showed a
   * figure and an "Order Print" button for an edition the wizard would refuse —
   * the exact dead end the file header says must never exist. The artwork detail
   * page had been correct since isEditionSoldOut landed; only the catalogue was
   * wrong. Runbook L-14/L-15.
   *
   * A sold-out edition STAYS in the catalogue. It is the best thing on the page,
   * and a buyer who saw it last week deserves to learn it sold out rather than
   * find it silently gone. It simply carries no price, which is what the grid
   * renders as "Sold out".
   */
  test('a sold-out limited edition is still listed, with no price', async () => {
    const fx = await setupLimitedFixture(3)
    const title = `E2E Limited SoldOut ${fx.slug}`
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: null, title },
      })
      expect((await cardFor(title))?.minPriceCents, 'priced while copies remain').not.toBeNull()

      await sellOut(fx.variantId)

      const card = await cardFor(title)
      expect(card, 'a sold-out edition stays in the catalogue').not.toBeNull()
      expect(
        card?.minPriceCents,
        'no price on an edition with nothing left to buy — the grid shows "Sold out"',
      ).toBeNull()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a reserved last copy counts as sold out, not as stock', async () => {
    const fx = await setupLimitedFixture(2)
    const title = `E2E Limited Reserved ${fx.slug}`
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: null, title },
      })
      // reserveEditionNumber only ever takes an 'available' number, so an
      // edition held entirely by live PaymentIntents cannot be bought right
      // now. The catalogue must agree with what checkout would do.
      await sellOut(fx.variantId, 'reserved')

      expect((await cardFor(title))?.minPriceCents).toBeNull()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('the price rises to the next variant when the cheapest sells out', async () => {
    const fx = await setupLimitedFixture(3)
    const title = `E2E Limited PriceRise ${fx.slug}`
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: null, title },
      })
      // A second, larger variant. Distinct size is required — the edition
      // identity rule is @@unique([artworkId, widthCm, heightCm]) — and a bigger
      // sheet costs more to print, so this one is genuinely the dearer of the two.
      const big = await prisma.limitedVariant.create({
        data: {
          artworkId: fx.artworkId,
          name: 'E2E Large',
          paperId: 'hahnemuhle-german-etching',
          printTypeId: 'giclee',
          widthCm: fx.widthCm * 1.5,
          heightCm: fx.heightCm * 1.5,
          borderCm: 3,
          editionSize: 3,
          priceCents: fx.artistPriceCents * 2,
          published: true,
          blocked: true,
          order: 1,
        },
      })
      await prisma.editionNumber.createMany({
        data: [1, 2, 3].map((n) => ({ variantId: big.id, number: n })),
      })

      const cheap = (await cardFor(title))?.minPriceCents
      expect(cheap, 'the small variant sets the opening price').not.toBeNull()

      await sellOut(fx.variantId)

      const dear = (await cardFor(title))?.minPriceCents
      expect(dear, 'the large variant still has copies, so the work is still priced').not.toBeNull()
      expect(dear!, 'the price rises on its own as cheaper variants sell out').toBeGreaterThan(
        cheap!,
      )
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('an OPEN edition never sells out', async () => {
    const fx = await setupLimitedFixture(3)
    const title = `E2E Open NeverSoldOut ${fx.slug}`
    try {
      // Open editions are printed on demand — stock is not a concept, and the
      // stock filter must not leak across the edition fork and mute their price.
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { editionType: 'open', printPriceCents: 25000, title },
      })
      await sellOut(fx.variantId)

      expect((await cardFor(title))?.minPriceCents).not.toBeNull()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('the edition filter still sorts them correctly', async () => {
    const fx = await setupLimitedFixture(3)
    const title = `E2E Limited Filter ${fx.slug}`
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: null, title },
      })
      expect(await titlesInCatalog('limited')).toContain(title)
      expect(await titlesInCatalog('open')).not.toContain(title)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
