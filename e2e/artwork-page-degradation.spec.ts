import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { setupOpenFixture, teardownOpenFixture } from './edition-helpers'

/**
 * The artwork page must be COMPLETE with nothing filled in.
 *
 * Supplementary media, the story text and the edition list are all optional and
 * will be added one work at a time, by hand, over months. An artwork with none
 * of it is therefore not a degraded state — it is the normal state, and the
 * common one. Nothing may render as an empty frame, a bare heading, a stray
 * divider or an "add an image here" placeholder.
 *
 * Written BEFORE the rich cases exist, so graceful degradation is proven rather
 * than assumed. The dashed boxes in the design mockups are design placeholders;
 * on the live site they must be absent, not empty.
 *
 * Flat page: no WebGL here.
 */
test.describe('an artwork with no optional data', () => {
  test('renders the core work and nothing else', async ({ page }) => {
    const fx = await setupOpenFixture()
    const title = `E2E Bare Artwork ${fx.slug}`
    try {
      // Strip every optional field: no story, no technique, no dimensions.
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { title, description: null, technique: null, dimensions: null },
      })

      const response = await page.goto(`/artworks/${fx.slug}`)
      expect(response?.status(), 'the page must still render').toBeLessThan(400)

      // The work itself is present.
      await expect(page.getByText(title).first()).toBeVisible()
      await expect(page.locator('img').first()).toBeVisible()

      // None of the optional furniture appears.
      const body = page.locator('body')
      await expect(body, 'no empty imagery heading').not.toContainText(/^\s*Editions\s*$/m)
      await expect(body, 'no upload placeholder ever reaches a buyer').not.toContainText(
        /browse files|3D render \/ in-situ view|Print detail close-up/i,
      )
      await expect(body, 'no undefined leaking into copy').not.toContainText(/undefined|null/i)

      // No carousel chrome without slides to move between.
      // Anchored to the carousel's own labels. A loose /next|previous/ also
      // matches Next.js's "Open Next.js Dev Tools" button, which mounts in dev
      // and has nothing to do with this page — do not widen it back.
      await expect(
        page.getByRole('button', { name: /^(next|previous) image$/i }),
        'no carousel chrome without slides',
      ).toHaveCount(0)
    } finally {
      await teardownOpenFixture(fx)
    }
  })
})
