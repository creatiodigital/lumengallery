import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The curator's screen. Its job is to make a wrong selection visible: an entry
 * that has stopped selling stays in the list, greyed, with the reason — the
 * decision was to flag, never to silently un-curate.
 */
test('a sold-out entry stays listed, greyed, with its reason', async ({ page }) => {
  const fx = await setupLimitedFixture(2)
  const title = `E2E Admin SoldOut ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })
    await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })
    await prisma.editionNumber.updateMany({
      where: { variantId: fx.variantId },
      data: { state: 'sold' },
    })

    await page.goto('/admin/content/gallery-selection')
    const row = page.locator('[data-selection-row]', { hasText: title })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Sold out')
    await expect(row, 'sold out is shown, not hidden').toContainText('shown on the page')
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})

test('removing an entry drops it from the list and from /prints', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  const title = `E2E Admin Remove ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })
    await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })

    await page.goto('/admin/content/gallery-selection')
    await page
      .locator('[data-selection-row]', { hasText: title })
      .getByRole('button', { name: 'Remove' })
      .click()
    await expect(page.locator('[data-selection-row]', { hasText: title })).toHaveCount(0)

    await page.goto('/prints')
    await expect(page.getByText(title)).toHaveCount(0)
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})

test('the picker adds a work by artist, and it lands on /prints', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  const title = `E2E Picker ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })

    // The cookie banner overlays the bottom of the screen and intercepts
    // pointer events until a decision is stored — which reaches the picker's
    // footer buttons even though "Add artworks" itself now sits up top.
    await seedCookieConsent(page)
    await page.goto('/admin/content/gallery-selection')
    await page.getByRole('button', { name: 'Add artworks' }).click()

    // By artist: filter the artist list, drill in, tick, add.
    await page.getByPlaceholder('Search artists').fill('John')
    await page.getByRole('button', { name: /John Doe/ }).click()
    // The whole card is the control — role="checkbox" on the card button, so
    // clicking anywhere on it toggles.
    await page.locator('[data-picker-row]', { hasText: title }).click()
    await page.getByRole('button', { name: /^Add 1$/ }).click()

    await expect(page.locator('[data-selection-row]', { hasText: title })).toBeVisible()

    await page.goto('/prints')
    await expect(page.getByText(title)).toBeVisible()
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})

test('an already-selected work is not offered again', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  const title = `E2E Picker Dup ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })
    await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })

    await seedCookieConsent(page)
    await page.goto('/admin/content/gallery-selection')
    await page.getByRole('button', { name: 'Add artworks' }).click()
    await page.getByRole('button', { name: 'By name' }).click()
    await page.getByPlaceholder('Search by title').fill(title)

    await expect(page.locator('[data-picker-row]', { hasText: title })).toHaveCount(0)
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})
