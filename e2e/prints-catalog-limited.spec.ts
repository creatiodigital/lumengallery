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

async function titlesInCatalog(edition?: 'open' | 'limited') {
  // Page size is bounded, so page through rather than assume one page holds
  // the fixture. Small dataset; a couple of round-trips is fine.
  const seen: string[] = []
  for (let page = 1; page <= 10; page++) {
    const { items, totalCount } = await getPrintsCatalogPage({ page, edition: edition ?? '' })
    seen.push(...items.map((i) => i.title ?? i.name ?? ''))
    if (seen.length >= totalCount || items.length === 0) break
  }
  return seen
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
