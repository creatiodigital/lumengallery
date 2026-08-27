import { test, expect } from '@playwright/test'

import { getGallerySelection, getGallerySelectionForAdmin } from '@/lib/queries/getGallerySelection'
import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The selection is the whole of /prints, so what it returns IS the shop.
 *
 * Two conditions get a work onto the page: currently selling, and in the
 * selection. "Currently selling" is TRUE of a SOLD-OUT edition — the work is on
 * sale, there is simply nothing left of it — so those stay, marked. Only work
 * that is not for sale at all is hidden: an Order Print button there is a dead
 * end, and there is no story to tell.
 */
async function select(artworkId: string, order = 0) {
  return prisma.selectedPrint.create({ data: { artworkId, order } })
}

test('a live selected print appears publicly, priced', async () => {
  const fx = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title: `E2E Sel Live ${fx.slug}` },
    })
    await select(fx.artworkId)

    const card = (await getGallerySelection()).find((c) => c.id === fx.artworkId)
    expect(card, 'a live selected print belongs on the page').toBeTruthy()
    expect(card!.sale.minPriceCents).toBeGreaterThan(0)
  } finally {
    await teardownLimitedFixture(fx)
  }
})

test('a sold-out selected print STAYS on the page, marked, and is counted in admin', async () => {
  const fx = await setupLimitedFixture(2)
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title: `E2E Sel SoldOut ${fx.slug}` },
    })
    await select(fx.artworkId)
    await prisma.editionNumber.updateMany({
      where: { variantId: fx.variantId },
      data: { state: 'sold' },
    })

    const card = (await getGallerySelection()).find((c) => c.id === fx.artworkId)
    expect(card, 'a sold edition is the best thing on the page — it stays').toBeTruthy()
    expect(card!.sale.minPriceCents, 'no price: the grid shows "Sold out", not a CTA').toBeNull()

    const row = (await getGallerySelectionForAdmin()).find((r) => r.artwork.id === fx.artworkId)
    expect(row?.status, 'the curator sees it sold, and can weigh the ratio').toBe('sold-out')
  } finally {
    await teardownLimitedFixture(fx)
  }
})

test('a print-disabled selected work reads as not-for-sale, not sold-out', async () => {
  const fx = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printEnabled: false, title: `E2E Sel Off ${fx.slug}` },
    })
    await select(fx.artworkId)

    expect((await getGallerySelection()).map((c) => c.id)).not.toContain(fx.artworkId)
    const row = (await getGallerySelectionForAdmin()).find((r) => r.artwork.id === fx.artworkId)
    expect(row?.status, 'never sold, so "sold out" would invent a history').toBe('not-for-sale')
  } finally {
    await teardownLimitedFixture(fx)
  }
})

test('the selection is returned in the admin order, not by date added', async () => {
  const a = await setupLimitedFixture(3)
  const b = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({ where: { id: a.artworkId }, data: { printPriceCents: null } })
    await prisma.artwork.update({ where: { id: b.artworkId }, data: { printPriceCents: null } })
    await select(a.artworkId, 10) // added first, ordered last
    await select(b.artworkId, 1)

    const ids = (await getGallerySelection()).map((c) => c.id)
    expect(ids.indexOf(b.artworkId)).toBeLessThan(ids.indexOf(a.artworkId))
  } finally {
    await teardownLimitedFixture(a)
    await teardownLimitedFixture(b)
  }
})

test('deleting an artwork removes its selection entry', async () => {
  const fx = await setupLimitedFixture(3)
  await prisma.artwork.update({ where: { id: fx.artworkId }, data: { printPriceCents: null } })
  await select(fx.artworkId)

  await prisma.artwork.delete({ where: { id: fx.artworkId } })

  const orphan = await prisma.selectedPrint.findFirst({ where: { artworkId: fx.artworkId } })
  expect(orphan, 'cascade prevents a ghost entry in the selection').toBeNull()
})

test('the same artwork cannot be selected twice', async () => {
  const fx = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({ where: { id: fx.artworkId }, data: { printPriceCents: null } })
    await select(fx.artworkId)
    await expect(select(fx.artworkId, 5)).rejects.toThrow()
  } finally {
    await teardownLimitedFixture(fx)
  }
})

/**
 * The picker's idea of "sellable" can go stale while the modal sits open, so the
 * server checks again. A batch that would half-apply is refused whole: a
 * curator who pressed Add on five works and silently got four has a selection
 * they did not choose.
 */
test('adding a work that stopped selling is refused, and refuses the whole batch', async ({
  request,
}) => {
  const good = await setupLimitedFixture(3)
  const bad = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({ where: { id: good.artworkId }, data: { printPriceCents: null } })
    await prisma.artwork.update({
      where: { id: bad.artworkId },
      data: { printEnabled: false, printPriceCents: null },
    })

    const res = await request.post('/api/selected-prints', {
      data: { artworkIds: [good.artworkId, bad.artworkId] },
    })
    expect(res.status()).toBe(400)

    const none = await prisma.selectedPrint.findMany({
      where: { artworkId: { in: [good.artworkId, bad.artworkId] } },
    })
    expect(none, 'no partial application').toHaveLength(0)
  } finally {
    await teardownLimitedFixture(good)
    await teardownLimitedFixture(bad)
  }
})

test('a newly added work lands at the TOP, above what was already there', async ({ request }) => {
  const existing = await setupLimitedFixture(3)
  const added = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({
      where: { id: existing.artworkId },
      data: { printPriceCents: null },
    })
    await prisma.artwork.update({ where: { id: added.artworkId }, data: { printPriceCents: null } })

    const a = await request.post('/api/selected-prints', {
      data: { artworkIds: [existing.artworkId] },
    })
    expect(a.ok()).toBeTruthy()
    const b = await request.post('/api/selected-prints', {
      data: { artworkIds: [added.artworkId] },
    })
    expect(b.ok()).toBeTruthy()

    const rows = await prisma.selectedPrint.findMany({
      where: { artworkId: { in: [existing.artworkId, added.artworkId] } },
    })
    const orderOf = (artworkId: string) => rows.find((r) => r.artworkId === artworkId)!.order
    expect(
      orderOf(added.artworkId),
      'the work just added is the one the curator wants seen — it goes on top',
    ).toBeLessThan(orderOf(existing.artworkId))
  } finally {
    await prisma.selectedPrint.deleteMany({
      where: { artworkId: { in: [existing.artworkId, added.artworkId] } },
    })
    await teardownLimitedFixture(existing)
    await teardownLimitedFixture(added)
  }
})

test('reorder writes the given order', async ({ request }) => {
  const a = await setupLimitedFixture(3)
  const b = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({ where: { id: a.artworkId }, data: { printPriceCents: null } })
    await prisma.artwork.update({ where: { id: b.artworkId }, data: { printPriceCents: null } })
    const added = await request.post('/api/selected-prints', {
      data: { artworkIds: [a.artworkId, b.artworkId] },
    })
    expect(added.ok()).toBeTruthy()

    const rows = await prisma.selectedPrint.findMany({
      where: { artworkId: { in: [a.artworkId, b.artworkId] } },
    })
    const idOf = (artworkId: string) => rows.find((r) => r.artworkId === artworkId)!.id
    const res = await request.post('/api/selected-prints/reorder', {
      data: { ids: [idOf(b.artworkId), idOf(a.artworkId)] },
    })
    expect(res.ok()).toBeTruthy()

    const after = await prisma.selectedPrint.findMany({
      where: { artworkId: { in: [a.artworkId, b.artworkId] } },
    })
    const orderOf = (artworkId: string) => after.find((r) => r.artworkId === artworkId)!.order
    expect(orderOf(b.artworkId)).toBeLessThan(orderOf(a.artworkId))
  } finally {
    await teardownLimitedFixture(a)
    await teardownLimitedFixture(b)
  }
})

test('/prints renders the selection in order, and nothing else', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  const title = `E2E Prints Selected ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })
    await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })

    await page.goto('/prints')
    await expect(page.getByText(title)).toBeVisible()
    // One door: the card's CTA leads to the artwork page, never straight into
    // the wizard.
    await expect(
      page.locator(`a[href="/artworks/${fx.slug}"]`, { hasText: 'Order Print' }),
    ).toBeVisible()
    // The page says what it is: a choice, not the catalogue. Without this line
    // a buyer reads the grid as everything for sale and never looks for the
    // print on an exhibition or artist page.
    await expect(page.getByText('A curated selection', { exact: false })).toBeVisible()

    // The toolbar STAYS — it is production UI. Its filters now run over the
    // curated list in memory, and the cart lives in it: this page is the only
    // non-wizard cart affordance, so losing the row loses the cart.
    await expect(page.getByText('All artists')).toBeVisible()
    await expect(page.getByText('All Editions')).toBeVisible()
    await expect(page.getByRole('link', { name: /^Cart, \d+ items?$/ })).toBeVisible()

    // What DID go with the catalogue: the pager. A curated selection is one page.
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toHaveCount(0)

    // Sell it out — it must STAY, swapping its CTA for the badge.
    await prisma.editionNumber.updateMany({
      where: { variantId: fx.variantId },
      data: { state: 'sold' },
    })
    await page.reload()
    await expect(page.getByText(title)).toBeVisible()
    await expect(page.getByText('Sold out')).toBeVisible()
    await expect(page.locator(`a[href="/artworks/${fx.slug}/print"]`)).toHaveCount(0)
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})
