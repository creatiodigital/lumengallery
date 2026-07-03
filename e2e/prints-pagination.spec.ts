import { test, expect, type Page } from '@playwright/test'

/**
 * /prints — pagination + server-side filtering (AR-130).
 *
 * The page SSRs the first 24-item page via the `getPrintsCatalogPage` server
 * action, then a client browser drives further pages + filters through the same
 * action. This spec asserts the data-robust invariants:
 *   - the route resolves and the SSR'd grid renders,
 *   - the grid never exceeds one page worth (24) of cards,
 *   - no pagination control appears while the catalog fits on one page,
 *   - the edition filter narrows the result set server-side (selecting one
 *     edition never leaves a card of the other edition on screen).
 *
 * Read-only: navigates + toggles filters, no writes.
 *
 * NOTE: multi-page navigation (click page 2, reset-to-page-1 on filter) can't be
 * exercised here until the dev DB holds >24 print-enabled, published works — at
 * the time of writing it holds 4, so the catalog is a single page. The page
 * windowing + reset logic is covered by typecheck/build; revisit this spec to
 * add a page-2 assertion once the catalog grows (or via a seeded fixture).
 */

const PAGE_SIZE = 24

// Each grid card carries exactly one "Order Print" CTA (rendered as a link),
// so counting those counts the visible cards.
const orderPrintLinks = (page: Page) => page.getByRole('link', { name: /order print/i })

test('prints page: SSR grid renders and caps at one page', async ({ page }) => {
  const response = await page.goto('/prints')
  expect(response?.status(), '/prints should respond 200').toBe(200)

  await expect(
    page.getByRole('heading', { name: 'Prints', exact: true }),
    '/prints should render its header',
  ).toBeVisible()

  const cards = orderPrintLinks(page)
  const count = await cards.count()
  expect(count, 'the SSR first page should render at least one print card').toBeGreaterThan(0)
  expect(count, `the grid must not exceed ${PAGE_SIZE} cards per page`).toBeLessThanOrEqual(
    PAGE_SIZE,
  )

  // The dev catalog fits on one page, so no pagination control should render.
  await expect(
    page.getByRole('navigation', { name: 'Pagination' }),
    'no pagination control while the catalog fits on a single page',
  ).toHaveCount(0)
})

test('prints page: edition filter narrows results server-side', async ({ page }) => {
  await page.goto('/prints')
  await expect(orderPrintLinks(page).first()).toBeVisible()

  // Custom SelectDropdown: the closed control is a button labeled with the
  // current value; opening it reveals role="option" entries.
  // Filter to Open editions → no Limited-edition card may remain.
  await page.getByRole('button', { name: 'All Editions', exact: true }).click()
  await page.getByRole('option', { name: 'Open Editions', exact: true }).click()
  await expect(
    page.getByText('Limited Edition', { exact: true }),
    'filtering Open editions must drop every Limited-edition card',
  ).toHaveCount(0)

  // Filter to Limited editions → no Open-edition card may remain (an empty
  // result is fine — that's still zero Open cards).
  await page.getByRole('button', { name: 'Open Editions', exact: true }).click()
  await page.getByRole('option', { name: 'Limited Editions', exact: true }).click()
  await expect(
    page.getByText('Open Edition', { exact: true }),
    'filtering Limited editions must drop every Open-edition card',
  ).toHaveCount(0)
})
