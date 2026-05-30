import { test, expect } from '@playwright/test'

/**
 * CMS / static content pages must render — never 500.
 *
 * Each of these is a server component that fetches its body via
 * getStaticPageContent(slug) and renders sanitized HTML. If that fetch
 * or render throws (missing content, a server-only import blowing up,
 * sanitizer issues), the route returns a 500 — which is how these pages
 * have broken before. This spec visits every footer/legal page and
 * asserts a real 200 with rendered content, not an error page.
 *
 * NOTE: the nastiest version of this failure only reproduces in a
 * production build (the dev server's loader is more forgiving). To catch
 * that class, run `pnpm test:e2e:prod-build`, which runs this same spec
 * against `next build && next start`.
 */

const cmsPages: Array<{ label: string; path: string }> = [
  { label: 'About', path: '/about' },
  { label: 'Terms and Conditions', path: '/terms-and-conditions' },
  { label: 'Online Terms of Sale', path: '/terms-of-sale' },
  { label: 'Privacy Policy', path: '/privacy-policy' },
  { label: 'Accessibility Policy', path: '/accessibility-policy' },
]

for (const { label, path } of cmsPages) {
  test(`cms page renders (no 500): ${label}`, async ({ page }) => {
    const response = await page.goto(path)
    const status = response?.status() ?? 0
    expect(status, `${path} returned ${status}; expected 200`).toBe(200)

    // A render error can still return 200 but paint Next's error UI, so
    // assert the page neither shows an error nor is blank.
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
