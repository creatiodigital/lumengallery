import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * The artwork's own story — full width, at reading measure, below the image.
 *
 * Optional like everything else on this page: most works have no description,
 * and that is the normal case rather than a degraded one.
 */
test.describe('the story section', () => {
  test('the story renders full width when the artwork has one, and not otherwise', async ({
    page,
  }) => {
    const fx = await setupLimitedFixture(5)
    const story = 'E2E story taken on the banks of the Rhine'
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { description: `<p>${story}</p>` },
      })
      await page.goto(`/artworks/${fx.slug}`)
      await expect(page.getByText(story)).toBeVisible()

      await prisma.artwork.update({ where: { id: fx.artworkId }, data: { description: null } })
      await page.goto(`/artworks/${fx.slug}`)
      await expect(page.getByText(story)).toHaveCount(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
