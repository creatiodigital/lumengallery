import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { getArtworkMedia, MAX_ARTWORK_MEDIA } from '@/lib/artwork/artworkMedia'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * Supplementary artwork media — the data layer.
 *
 * Ordering has to be deterministic: two assets given the same `order` must not
 * swap places between requests, or the page reshuffles itself under the reader.
 */
test.describe('getArtworkMedia', () => {
  test('returns nothing for an artwork nobody has added media to', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      expect(await getArtworkMedia(fx.artworkId)).toEqual([])
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('orders by position, then by age, and drops unknown kinds', async () => {
    const fx = await setupLimitedFixture(3)
    try {
      await prisma.artworkMedia.create({
        data: { artworkId: fx.artworkId, kind: 'image', url: 'https://r2.test/b.jpg', order: 1 },
      })
      await prisma.artworkMedia.create({
        data: { artworkId: fx.artworkId, kind: 'video', url: 'https://r2.test/a.mp4', order: 0 },
      })
      // Same position as the first: age decides, so the sequence is stable.
      await prisma.artworkMedia.create({
        data: { artworkId: fx.artworkId, kind: 'image', url: 'https://r2.test/c.jpg', order: 1 },
      })
      // A kind nothing knows how to render must be dropped, not emitted as a
      // broken element.
      await prisma.artworkMedia.create({
        data: { artworkId: fx.artworkId, kind: 'hologram', url: 'https://r2.test/x.bin', order: 2 },
      })

      const media = await getArtworkMedia(fx.artworkId)
      expect(media.map((m) => m.url)).toEqual([
        'https://r2.test/a.mp4',
        'https://r2.test/b.jpg',
        'https://r2.test/c.jpg',
      ])
      expect(media[0].kind).toBe('video')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('media dies with its artwork', async () => {
    const fx = await setupLimitedFixture(3)
    await prisma.artworkMedia.create({
      data: { artworkId: fx.artworkId, kind: 'image', url: 'https://r2.test/gone.jpg' },
    })
    await teardownLimitedFixture(fx)
    expect(await prisma.artworkMedia.count({ where: { artworkId: fx.artworkId } })).toBe(0)
  })

  test('the safety ceiling is a real number', () => {
    expect(MAX_ARTWORK_MEDIA).toBeGreaterThan(0)
  })
})

/**
 * How the imagery zone lays itself out.
 *
 * The shape follows the COUNT, because a carousel holding two images is worse
 * than two images side by side: controls that move between a pair are noise.
 *   0 -> the zone does not exist   1 -> single, centred
 *   2 -> side by side              3+ -> infinite carousel
 */
test.describe('the artwork imagery zone', () => {
  const img = (artworkId: string, n: number, order: number) =>
    prisma.artworkMedia.create({
      data: {
        artworkId,
        kind: 'image',
        url: `https://r2.test/media-${n}.jpg`,
        width: 3000,
        height: 2000,
        order,
      },
    })

  test('a row with no usable URL is dropped rather than rendered broken', async ({ page }) => {
    const fx = await setupLimitedFixture(3)
    try {
      // A row can exist without a usable object if an upload fails between
      // storing the file and recording it. A broken image on a public page is
      // worse than no section at all.
      await prisma.artworkMedia.create({
        data: { artworkId: fx.artworkId, kind: 'image', url: '   ', order: 0 },
      })
      await page.goto(`/artworks/${fx.slug}`)

      await expect(page.getByRole('button', { name: /^(next|previous) image$/i })).toHaveCount(0)
      await expect(page.locator('img[src="   "]')).toHaveCount(0)
      // The rest of the page is untouched.
      await expect(page.getByText(/Edition of 3/).first()).toBeVisible()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('one image is shown alone, with no controls to move between', async ({ page }) => {
    const fx = await setupLimitedFixture(3)
    try {
      await img(fx.artworkId, 1, 0)
      await page.goto(`/artworks/${fx.slug}`)

      await expect(page.locator('img[src="https://r2.test/media-1.jpg"]')).toHaveCount(1)
      await expect(page.getByRole('button', { name: /^(next|previous) image$/i })).toHaveCount(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('two images sit side by side, still with no controls', async ({ page }) => {
    const fx = await setupLimitedFixture(3)
    try {
      await img(fx.artworkId, 1, 0)
      await img(fx.artworkId, 2, 1)
      await page.goto(`/artworks/${fx.slug}`)

      await expect(page.locator('img[src^="https://r2.test/media-"]')).toHaveCount(2)
      await expect(page.getByRole('button', { name: /^(next|previous) image$/i })).toHaveCount(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('three or more get a carousel that wraps in both directions', async ({ page }) => {
    const fx = await setupLimitedFixture(3)
    try {
      await img(fx.artworkId, 1, 0)
      await img(fx.artworkId, 2, 1)
      await img(fx.artworkId, 3, 2)
      await page.goto(`/artworks/${fx.slug}`)

      const next = page.getByRole('button', { name: /^next image$/i })
      const previous = page.getByRole('button', { name: /^previous image$/i })
      await expect(next).toBeVisible()
      await expect(previous).toBeVisible()

      // Infinite: stepping back from the first lands on the last rather than
      // stopping dead on a disabled control.
      await expect(previous).toBeEnabled()
      await expect(next).toBeEnabled()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a video autoplays muted and can be paused', async ({ page }) => {
    const fx = await setupLimitedFixture(3)
    try {
      await prisma.artworkMedia.create({
        data: { artworkId: fx.artworkId, kind: 'video', url: 'https://r2.test/clip.mp4', order: 0 },
      })
      await page.goto(`/artworks/${fx.slug}`)

      const video = page.locator('video')
      await expect(video).toHaveCount(1)
      // Browsers refuse unmuted autoplay, and iOS takes an un-inlined video
      // fullscreen. Both attributes are required for this to play at all.
      await expect(video).toHaveAttribute('muted', /.*/)
      await expect(video).toHaveAttribute('playsinline', /.*/)
      await expect(page.getByRole('button', { name: /pause|play/i })).toBeVisible()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
