import { test, expect } from '@playwright/test'

import { routes } from './fixtures'

/**
 * Public profile pages must render — never 500.
 *
 * The artist profile (`/artists/[slug]`) and exhibition profile
 * (`/exhibitions/[artistSlug]/[exhibitionSlug]`) are server-rendered
 * from cached DB reads. If a query or render throws they 500 — the same
 * class of failure that hit the CMS pages. These visit the real fixture
 * entities and assert a 200 with rendered content, not an error page.
 *
 * Note: these are the WebGL-free PROFILE pages. The 3D scene lives only
 * on the `/visit` route, which is deliberately not tested (see memory:
 * no WebGL e2e). The nastier prod-only 500s reproduce under
 * `pnpm test:e2e:prod-build`.
 */

const profilePages: Array<{ label: string; path: string }> = [
  { label: 'artist profile', path: routes.artistProfile() },
  { label: 'exhibition profile', path: routes.exhibition() },
]

for (const { label, path } of profilePages) {
  test(`profile page renders (no 500): ${label}`, async ({ page }) => {
    const response = await page.goto(path)
    const status = response?.status() ?? 0
    expect(status, `${path} returned ${status}; expected 200`).toBe(200)

    await expect(
      page.locator('body'),
      `${path} should not show an error boundary`,
    ).not.toContainText(/application error|internal server error|something went wrong/i)

    await expect(
      page.getByRole('heading').first(),
      `${path} should render real content (a heading)`,
    ).toBeVisible()
  })
}
