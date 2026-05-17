import { test, expect } from '@playwright/test'

import { fixtures, routes } from './fixtures'

/**
 * Print wizard — the most business-critical surface. Touches the
 * catalog builder + per-artwork restriction filter. Country is no
 * longer asked here (it lives on the checkout step), so options
 * render immediately on first paint.
 *
 * Baseline: route resolves, wizard shell hydrates, the catalog
 * produces both the Print and Print size sections. Full price flow
 * lives in print-totals-consistency.spec.ts.
 *
 * Read-only.
 */
test('print wizard: print + size sections visible immediately', async ({ page }) => {
  const response = await page.goto(routes.printWizard(fixtures.artworkSlug))
  expect(response?.status(), 'print wizard should respond 2xx').toBeLessThan(400)

  // TPS bundles printType+paper into a single "Print" section and
  // size+border into "Print size". Both should be visible on first
  // paint — no destination gate.
  await expect(
    page.getByRole('button', { name: /^Print$/ }).first(),
    'wizard should expose a Print section (printType + paper)',
  ).toBeVisible({ timeout: 30_000 })

  await expect(
    page.getByRole('button', { name: /^Print size$/ }).first(),
    'wizard should expose a Print size section',
  ).toBeVisible({ timeout: 30_000 })
})
