import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * The availability card — the compact block in the artwork page's left column.
 *
 * It must sit ABOVE THE FOLD, so it is deliberately terse: a price, the edition
 * this buyer would receive, the one caveat that matters, and the button. The
 * fuller explanation lives in the band further down the page.
 *
 * It describes exactly ONE configuration — the cheapest live variant, the one
 * the price belongs to — so the figure and the edition can never describe
 * different objects.
 *
 * Flat page: no WebGL.
 */
test.describe('the availability card', () => {
  test('names the price, the copy on offer and the caveat', async ({ page }) => {
    const fx = await setupLimitedFixture(5)
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { title: `E2E Card ${fx.slug}` },
      })

      await page.goto(`/artworks/${fx.slug}`)

      // Stated ONCE. A second commerce block below the image used to restate
      // all of this; it was removed because directly under the artwork it read
      // as a stutter rather than a convenience.
      await expect(page.getByText('Available for purchase')).toHaveCount(1)
      await expect(page.getByText(/^€[\d.,]+$/).first()).toBeVisible()
      await expect(page.getByText('Limited Edition')).toHaveCount(1)

      // The row states the edition SIZE and makes no claim about copies. "X of
      // Y" is the edition-number convention, so any count in that shape reads
      // as "this is copy X" — which the page cannot honestly promise.
      await expect(page.getByText(/Edition of 5/).first()).toBeVisible()

      // Editions are not held before payment — the card says so plainly rather
      // than pretending otherwise or reserving anything. This caveat belongs to
      // the card ALONE, so it must not be duplicated.
      await expect(page.getByText(/not reserved until you pay/i)).toHaveCount(1)

      await expect(page.getByRole('button', { name: /order a print/i }).first()).toBeVisible()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a work that is not for sale has no card at all', async ({ page }) => {
    const fx = await setupLimitedFixture(5)
    try {
      // Unpublish every variant: the work stays in the catalogue, but nothing
      // about buying it may appear.
      await prisma.limitedVariant.updateMany({
        where: { artworkId: fx.artworkId },
        data: { published: false },
      })

      await page.goto(`/artworks/${fx.slug}`)

      await expect(page.getByText('Available for purchase')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /order a print/i })).toHaveCount(0)
      await expect(page.getByText(/not reserved until you pay/i)).toHaveCount(0)
      // The work itself is still here, and still enquirable.
      await expect(page.getByRole('button', { name: /inquire/i })).toBeVisible()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
