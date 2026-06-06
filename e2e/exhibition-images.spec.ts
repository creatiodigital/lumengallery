import { test, expect } from '@playwright/test'

import { routes } from './fixtures'

/**
 * Every image on the public exhibition page must actually PAINT — not just
 * return 200 HTML.
 *
 * AR-125: exhibition images broke on first load (a failed `/_next/image` cold
 * transform on Vercel) yet the page was a clean 200 and the profile-render
 * smoke test still passed — the broken image was invisible to e2e *and* to
 * Sentry (a broken <img> doesn't throw). Asserting `naturalWidth > 0` is what
 * catches this class of bug deterministically.
 *
 * Scope: the WebGL-free exhibition PROFILE page only. The 3D `/visit` route and
 * the artwork-detail viewer mount R3F/WebGL and are deliberately excluded
 * (see memory: no WebGL e2e).
 */
test(`all images paint (naturalWidth > 0): exhibition profile`, async ({ page }) => {
  const path = routes.exhibition()
  const response = await page.goto(path)
  expect(response?.status() ?? 0, `${path} returned a non-200`).toBe(200)

  // Trigger lazy-loaded (below-the-fold) grid images before asserting.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let y = 0
        const step = () => {
          window.scrollTo(0, y)
          y += window.innerHeight
          if (y < document.body.scrollHeight) {
            requestAnimationFrame(step)
          } else {
            window.scrollTo(0, 0)
            resolve()
          }
        }
        step()
      }),
  )

  // Poll until every real <img> has decoded, then assert none failed. Skips
  // inline data:/blob: placeholders (e.g. blur placeholders), which have no
  // network fetch to fail.
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('img'))
            .filter((img) => {
              const src = img.currentSrc || img.src
              return Boolean(src) && !src.startsWith('data:') && !src.startsWith('blob:')
            })
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => img.currentSrc || img.src),
        ),
      {
        message: `${path}: these images failed to paint (naturalWidth 0)`,
        timeout: 15_000,
      },
    )
    .toEqual([])
})
