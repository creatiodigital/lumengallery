import { test, expect } from '@playwright/test'

import { getGallerySelection } from '@/lib/queries/getGallerySelection'
import { getPublicArtistByHandler } from '@/lib/queries/getPublicArtistByHandler'
import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture, type LimitedFixture } from './edition-helpers'
import { fixtures } from './fixtures'

/**
 * Previous/next arrows through a set of works.
 *
 * One mechanism, three sets: the grid stamps a context onto every card link, and
 * the artwork page turns that context into two neighbour hrefs. The exhibition
 * case is the original; /prints and the artist profile reuse it. What makes it
 * worth a test is the CHAIN — the context has to survive each hop, or the arrows
 * work once and then strand the visitor on a page with no way back into the set.
 *
 * The /prints fixtures are ordered to land at the END of the selection, whatever
 * else the dev DB already has selected. That makes the last one genuinely last,
 * which is the only way to assert that the final work has no next arrow.
 *
 * The artist block uses the SEEDED artist rather than fixtures:
 * `setupLimitedFixture` does not set `featured`, and the profile grid renders
 * only featured image works — a fixture would never appear on it.
 */

const ORDER_BASE = 900_000

/** A live, currently-selling limited edition, placed in the selection. */
async function selectFixture(index: number): Promise<LimitedFixture> {
  const fx = await setupLimitedFixture(3)
  await prisma.artwork.update({
    where: { id: fx.artworkId },
    // `printPriceCents: null` keeps this a limited edition only — an open-edition
    // price would put a second sale channel on the card and change what the grid
    // renders. The title is distinctive so a failure names the work.
    data: { printPriceCents: null, title: `E2E Prints Nav ${index} ${fx.slug}` },
  })
  await prisma.selectedPrint.create({
    data: { artworkId: fx.artworkId, order: ORDER_BASE + index },
  })
  return fx
}

test.describe('prints previous/next arrows', () => {
  let fixtures: LimitedFixture[] = []

  test.beforeAll(async () => {
    // Sequential, not Promise.all: `order` decides the arrows' sequence, and
    // `createdAt` is the tiebreaker the query falls back on.
    fixtures = []
    for (let i = 0; i < 3; i++) fixtures.push(await selectFixture(i))
  })

  test.afterAll(async () => {
    // SelectedPrint rows go with the artwork — the relation cascades.
    for (const fx of fixtures) await teardownLimitedFixture(fx)
  })

  test('every card on /prints carries the context', async ({ page }) => {
    await page.goto('/prints')

    const hrefs = await page
      .locator('a[href*="/artworks/"]')
      .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href') ?? ''))])

    expect(hrefs.length, 'the selection must not be empty for this to mean anything').toBeGreaterThan(
      0,
    )
    for (const href of hrefs) {
      expect(href, `${href} must mark the set it belongs to`).toContain('from=prints')
    }
  })

  test('the arrows walk the selection, carrying the context each hop', async ({ page }) => {
    const selection = await getGallerySelection()
    const slugs = selection.map((c) => c.slug)
    const [first, second, third] = fixtures

    // The fixtures own the tail of the selection, in order.
    expect(slugs.slice(-3), 'fixtures must sit at the end, in order').toEqual([
      first.slug,
      second.slug,
      third.slug,
    ])

    await page.goto(`/artworks/${first.slug}?from=prints`)

    // First of the three: next leads to the second, context intact.
    const next = page.getByRole('link', { name: /^Next work:/ })
    await expect(next).toHaveAttribute('href', `/artworks/${second.slug}?from=prints`)

    // Follow it for real — this is the hop that a dropped context breaks.
    await next.click()
    await expect(page).toHaveURL(new RegExp(`/artworks/${second.slug}\\?from=prints$`))

    // Landed in the middle: both directions available, both still in the set.
    await expect(page.getByRole('link', { name: /^Previous work:/ })).toHaveAttribute(
      'href',
      `/artworks/${first.slug}?from=prints`,
    )
    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveAttribute(
      'href',
      `/artworks/${third.slug}?from=prints`,
    )
  })

  test('the last work in the selection offers no next', async ({ page }) => {
    const last = fixtures[2]
    await page.goto(`/artworks/${last.slug}?from=prints`)

    await expect(page.getByRole('link', { name: /^Previous work:/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveCount(0)
  })

  test('without the context there are no arrows at all', async ({ page }) => {
    // A direct link or search traffic: one work, not a set. The empty gutters
    // are still reserved so the picture renders at the same size — but they are
    // spans, and nothing is clickable.
    await page.goto(`/artworks/${fixtures[1].slug}`)

    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Previous work:/ })).toHaveCount(0)
  })

  test('a work not in the selection gets no arrows even with the context', async ({ page }) => {
    // A stale link, or a work the curator has since removed. The set no longer
    // contains it, so there is nothing to step through — arrows would be a lie
    // about where the visitor is.
    const stray = await setupLimitedFixture(2)
    try {
      await page.goto(`/artworks/${stray.slug}?from=prints`)

      await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveCount(0)
      await expect(page.getByRole('link', { name: /^Previous work:/ })).toHaveCount(0)
    } finally {
      await teardownLimitedFixture(stray)
    }
  })

  test('the work renders at the same size however it was reached', async ({ page }) => {
    // The gutters are reserved whether or not there is a set, so one artwork
    // cannot be two different sizes depending on the door the visitor came
    // through. Asserted as geometry: any implementation that holds it passes.
    const slug = fixtures[1].slug
    const measure = async (url: string) => {
      await page.goto(url)
      return page.locator('[class*="imageFrame"] img').boundingBox()
    }

    const withContext = await measure(`/artworks/${slug}?from=prints`)
    const bare = await measure(`/artworks/${slug}`)

    expect(withContext, 'the fixture must render an image').toBeTruthy()
    expect(Math.round(bare!.width)).toBe(Math.round(withContext!.width))
    expect(Math.round(bare!.x)).toBe(Math.round(withContext!.x))
  })
})

test.describe('artist profile previous/next arrows', () => {
  test('every card on the profile carries the artist context', async ({ page }) => {
    await page.goto(`/artists/${fixtures.artistSlug}`)

    const hrefs = await page
      .locator('a[href*="/artworks/"]')
      .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href') ?? ''))])

    expect(hrefs.length, 'the seeded artist must have featured works').toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(href, `${href} must mark the set it belongs to`).toContain(
        `artist=${fixtures.artistSlug}`,
      )
    }
  })

  test('the arrows walk the artist\'s works, carrying the context each hop', async ({ page }) => {
    const artist = await getPublicArtistByHandler(fixtures.artistSlug)
    const works = artist?.artworks ?? []
    test.skip(works.length < 3, 'needs at least three featured works to walk a middle')

    const [first, second, third] = works
    const context = `?artist=${fixtures.artistSlug}`

    await page.goto(`/artworks/${first.slug}${context}`)

    // First work: no previous, and next leads into the set.
    await expect(page.getByRole('link', { name: /^Previous work:/ })).toHaveCount(0)
    const next = page.getByRole('link', { name: /^Next work:/ })
    await expect(next).toHaveAttribute('href', `/artworks/${second.slug}${context}`)

    // The hop a dropped context breaks.
    await next.click()
    await expect(page).toHaveURL(new RegExp(`/artworks/${second.slug}\\${context}$`))

    await expect(page.getByRole('link', { name: /^Previous work:/ })).toHaveAttribute(
      'href',
      `/artworks/${first.slug}${context}`,
    )
    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveAttribute(
      'href',
      `/artworks/${third.slug}${context}`,
    )
  })

  test('the last work on the profile offers no next', async ({ page }) => {
    const artist = await getPublicArtistByHandler(fixtures.artistSlug)
    const works = artist?.artworks ?? []
    test.skip(works.length < 2, 'needs at least two featured works')

    await page.goto(`/artworks/${works[works.length - 1].slug}?artist=${fixtures.artistSlug}`)

    await expect(page.getByRole('link', { name: /^Previous work:/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveCount(0)
  })
})
