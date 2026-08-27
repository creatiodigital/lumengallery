import { test, expect } from '@playwright/test'

import { resolveArtworkSale, type SaleVariant } from '@/lib/editions/artworkSale'
import { LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import prisma from '@/lib/prisma'
import { getPublicArtistByHandler } from '@/lib/queries/getPublicArtistByHandler'
import { getPublicExhibitionByUrl } from '@/lib/queries/getPublicExhibitionByUrl'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { fixtures, routes } from './fixtures'

/**
 * The sale block on an artwork card — edition tag, price, "Order Print".
 *
 * /prints could get away with a grid-level `withOrderPrint` flag because its
 * query had already filtered the list down to purchasable work: every card was
 * for sale, so "no price" could only mean sold out. The artist and exhibition
 * grids hold everything an artist made, sellable or not, and on a mixed grid
 * that shortcut stamps "Sold out" on work that was never for sale.
 *
 * So the decision moves onto the card, and `resolveArtworkSale` is the one
 * place that makes it. Three outcomes, and telling them apart is the whole job:
 *
 *   null                    — not for sale; the card shows no commerce at all
 *   { minPriceCents: n }    — on sale at n
 *   { minPriceCents: null }  — live, but nothing left to buy → "Sold out"
 *
 * Calls the resolver and the page queries directly — no browser, no WebGL.
 */

const OPEN = {
  editionType: 'open',
  printEnabled: true,
  printPriceCents: 12_000,
  originalWidth: 4000,
  originalHeight: 3000,
}

const LIMITED = { ...OPEN, editionType: 'limited', printPriceCents: null }

const IN_STOCK: SaleVariant = {
  name: 'Small',
  priceCents: 12_000,
  paperId: 'hahnemuhle-german-etching',
  printTypeId: 'giclee',
  widthCm: 40,
  heightCm: 30,
  borderCm: 3,
  sheetWidthCm: null,
  sheetHeightCm: null,
  hasAvailableNumber: true,
}

test.describe('resolveArtworkSale', () => {
  test('an open edition on sale resolves to a price', () => {
    const sale = resolveArtworkSale(OPEN)
    expect(sale?.editionType).toBe('open')
    expect(sale?.minPriceCents).toBeGreaterThan(0)
  })

  test('an artwork with prints switched off carries no sale block', () => {
    expect(resolveArtworkSale({ ...OPEN, printEnabled: false })).toBeNull()
  })

  test('an open edition with no artist price carries no sale block', () => {
    expect(resolveArtworkSale({ ...OPEN, printPriceCents: null })).toBeNull()
  })

  /**
   * The trap this whole type exists to avoid. An unpriceable open edition is
   * purchasable by `isArtworkPurchasable` (it has a price) but cannot be
   * quoted (no pixel size, so no printable size). Returning a sale with a null
   * price would render "Sold out" — and open editions never sell out.
   */
  test('an open edition that cannot be quoted shows nothing, not "Sold out"', () => {
    expect(resolveArtworkSale({ ...OPEN, originalWidth: null, originalHeight: null })).toBeNull()
  })

  test('a limited edition with a live, in-stock variant resolves to a price', () => {
    const sale = resolveArtworkSale(LIMITED, [IN_STOCK])
    expect(sale?.editionType).toBe('limited')
    expect(sale?.minPriceCents).toBeGreaterThan(0)
  })

  test('a limited edition whose copies are gone is sold out, not absent', () => {
    // Live variants, no numbers left: the work is still on sale in every sense
    // the card cares about — there is simply nothing left to buy.
    const sale = resolveArtworkSale(LIMITED, [{ ...IN_STOCK, hasAvailableNumber: false }])
    expect(sale, 'a sold-out edition is marked, not hidden').not.toBeNull()
    expect(sale?.minPriceCents, 'no price on an edition with nothing left').toBeNull()
  })

  test('a limited edition with no live variant carries no sale block', () => {
    // Nothing was ever on sale — "Sold out" would invent a history.
    expect(resolveArtworkSale(LIMITED, [])).toBeNull()
  })

  test('the cheapest IN-STOCK variant sets the figure', () => {
    const soldOutCheap: SaleVariant = { ...IN_STOCK, hasAvailableNumber: false }
    const dear: SaleVariant = {
      ...IN_STOCK,
      name: 'Large',
      priceCents: 30_000,
      widthCm: 60,
      heightCm: 45,
      hasAvailableNumber: true,
    }
    const both = resolveArtworkSale(LIMITED, [soldOutCheap, dear])
    const dearOnly = resolveArtworkSale(LIMITED, [dear])
    expect(both?.minPriceCents, 'a sold-out variant must not keep quoting its price').toBe(
      dearOnly?.minPriceCents,
    )
  })
})

/**
 * What the DB says the answer should be for one artwork, computed from its own
 * row. The page queries must agree with this for every card they render — that
 * is the whole contract, and it holds whatever happens to be on sale today.
 */
async function expectedSaleFor(artworkId: string) {
  const row = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: {
      editionType: true,
      printEnabled: true,
      printPriceCents: true,
      originalWidth: true,
      originalHeight: true,
      limitedVariants: {
        where: LIVE_VARIANT_WHERE,
        select: {
          name: true,
          priceCents: true,
          paperId: true,
          printTypeId: true,
          widthCm: true,
          heightCm: true,
          borderCm: true,
          sheetWidthCm: true,
          sheetHeightCm: true,
          editionNumbers: { where: { state: 'available' }, select: { id: true }, take: 1 },
        },
      },
    },
  })
  if (!row) throw new Error(`artwork ${artworkId} vanished mid-test`)
  const { limitedVariants, ...artwork } = row
  return resolveArtworkSale(
    artwork,
    limitedVariants.map((v) => ({ ...v, hasAvailableNumber: v.editionNumbers.length > 0 })),
  )
}

test.describe('the artist page carries the sale block', () => {
  test('every featured card agrees with the sale rule', async () => {
    const artist = await getPublicArtistByHandler(fixtures.artistSlug)
    expect(
      artist,
      `fixture artist "${fixtures.artistSlug}" not found — check dev DB`,
    ).not.toBeNull()
    expect(
      artist!.artworks.length,
      'fixture artist has no featured work to assert on',
    ).toBeGreaterThan(0)

    for (const artwork of artist!.artworks) {
      expect(artwork.sale, `sale block for "${artwork.title ?? artwork.name}"`).toEqual(
        await expectedSaleFor(artwork.id),
      )
    }
  })

  test('a sellable limited edition shows a price on the artist page', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      // Featured is what puts a work on the artist page at all.
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { featured: true, printPriceCents: null, title: `E2E Artist Sale ${fx.slug}` },
      })

      const artist = await getPublicArtistByHandler(fixtures.artistSlug)
      const card = artist?.artworks.find((a) => a.id === fx.artworkId)
      expect(card, 'the featured work must reach the artist page').toBeTruthy()
      expect(card!.sale?.editionType).toBe('limited')
      expect(card!.sale?.minPriceCents, 'a live, in-stock edition is priced').toBeGreaterThan(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a work with prints switched off shows no commerce on the artist page', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { featured: true, printEnabled: false, title: `E2E Artist NoSale ${fx.slug}` },
      })

      const artist = await getPublicArtistByHandler(fixtures.artistSlug)
      const card = artist?.artworks.find((a) => a.id === fx.artworkId)
      expect(card, 'the work still belongs on the page').toBeTruthy()
      expect(card!.sale, 'no price, no CTA, and above all no "Sold out"').toBeNull()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})

test.describe('the exhibition page carries the sale block', () => {
  test('every card agrees with the sale rule', async () => {
    const exhibition = await getPublicExhibitionByUrl(fixtures.exhibitionSlug)
    expect(
      exhibition,
      `fixture exhibition "${fixtures.exhibitionSlug}" not found — check dev DB`,
    ).not.toBeNull()
    expect(exhibition!.artworks.length, 'fixture exhibition hangs no artwork').toBeGreaterThan(0)

    for (const artwork of exhibition!.artworks) {
      expect(artwork.sale, `sale block for "${artwork.title ?? artwork.name}"`).toEqual(
        await expectedSaleFor(artwork.id),
      )
    }
  })

  test('a currently-selling work on the exhibition carries a price', async () => {
    const exhibition = await getPublicExhibitionByUrl(fixtures.exhibitionSlug)
    const priced = exhibition!.artworks.filter((a) => (a.sale?.minPriceCents ?? 0) > 0)
    expect(
      priced.length,
      'the fixture exhibition hangs a work that is currently selling — it must show its price',
    ).toBeGreaterThan(0)
  })
})

/**
 * The rendered card. The data-layer specs above prove the queries carry the
 * sale; these prove the grid actually draws it — the gap that let a shipped
 * "it's the same shared component" turn into a page with no prices on it.
 *
 * Both routes are flat pages. Neither mounts the 3D scene (that lives on
 * /visit), so there is no WebGL here.
 */
test.describe('the grid renders the sale block', () => {
  // A card's whole job is to make someone curious enough to click. It carries
  // artist, title, year and — when the work is buyable — one button. Every
  // technical fact (technique, dimensions, edition, paper, price) now lives on
  // the artwork page, where it answers a question the visitor has actually
  // asked by arriving.
  test('a selling card shows artist, title and the CTA — and no technical detail', async ({
    page,
  }) => {
    const fx = await setupLimitedFixture(3)
    const dims = 'E2E 33 × 44 cm'
    const title = `E2E Grid Sale ${fx.slug}`
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { featured: true, printPriceCents: null, title, dimensions: dims },
      })

      await page.goto(routes.artistProfile())

      // The button now leads to the artwork page, not straight into the wizard:
      // the page is the single door to checkout, so the grid cannot bypass it.
      const cta = page.locator(`a[href="/artworks/${fx.slug}"]`, { hasText: 'Order Print' })
      await expect(cta).toBeVisible()

      const card = cta.locator('xpath=../../..')
      await expect(card).toContainText(title)
      await expect(card, 'no edition tag on a listing card').not.toContainText('Limited Edition')
      await expect(card, 'no dimensions on a listing card').not.toContainText(dims)
      await expect(card, 'no price on a listing card').not.toContainText('€')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a work not for sale shows no Order Print on the artist page', async ({ page }) => {
    const fx = await setupLimitedFixture(3)
    const title = `E2E Grid NoSale ${fx.slug}`
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { featured: true, printEnabled: false, title },
      })

      await page.goto(routes.artistProfile())

      await expect(
        page.getByText(title).first(),
        'the work still belongs on the page',
      ).toBeVisible()
      await expect(page.locator(`a[href="/artworks/${fx.slug}/print"]`)).toHaveCount(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a currently-selling work shows Order Print on the exhibition page', async ({ page }) => {
    const exhibition = await getPublicExhibitionByUrl(fixtures.exhibitionSlug)
    const selling = exhibition!.artworks.find((a) => (a.sale?.minPriceCents ?? 0) > 0)
    expect(selling, 'the fixture exhibition must hang a currently-selling work').toBeTruthy()

    await page.goto(routes.exhibition())

    // Same one-door rule as every other grid: the CTA leads to the artwork
    // page, and the wizard is reachable only from there.
    const cta = page.locator(`a[href="/artworks/${selling!.slug}"]`, { hasText: 'Order Print' })
    await expect(cta).toBeVisible()
    await expect(cta.locator('xpath=..'), 'no price on a listing card').not.toContainText('€')
  })

  test('the prints page does NOT show the artwork dimensions', async ({ page }) => {
    const fx = await setupLimitedFixture(3)
    // Distinctive enough that it cannot collide with a real work's dimensions.
    const dims = 'E2E 33 × 44 cm'
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { printPriceCents: null, dimensions: dims, title: `E2E Prints Dims ${fx.slug}` },
      })
      // /prints now renders the gallery's curated selection, not the whole
      // catalogue (AR-140) — a work must be selected to appear here.
      await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })

      await page.goto('/prints')
      // Dimensions describe the ORIGINAL, not the sheet the buyer receives.
      // Next to an order button that is actively misleading, so they moved to
      // the artwork page where they can be labelled.
      await expect(page.getByText(dims)).toHaveCount(0)
    } finally {
      await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
      await teardownLimitedFixture(fx)
    }
  })
})
