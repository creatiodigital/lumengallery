import { test, expect, type Page } from '@playwright/test'

import prisma from '@/lib/prisma'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Impersonating an artist must never show another user's exhibitions.
 *
 * The dashboard renders `state.user.exhibitionsById` — Redux state that was not
 * scoped to a user and was only ever overwritten by a SUCCESSFUL fetch. Nothing
 * cleared it when the effective user changed, so the previous user's list stayed
 * on screen under the new user's banner and greeting.
 *
 * Two details decide whether the bug appears, and together they are why it read
 * as random:
 *
 *   - A HARD page load rebuilds the store, so the bug cannot happen. Anyone
 *     reproducing by typing the URL or pressing F5 sees it work every time.
 *   - Reaching the admin screens by CLICKING keeps the store alive. Add a slow
 *     or failed request for the new user and the stale list is never replaced.
 *
 * So this spec navigates client-side throughout — a `page.goto` between the two
 * impersonations would silently make it pass for the wrong reason — and fails
 * one request to hold the window open, which is what a flaky network does on its
 * own. The assertion is the invariant, not the timing: what is on screen belongs
 * to the artist named in the banner.
 */

/** Exhibition names currently rendered in the dashboard table. */
const renderedExhibitions = (page: Page) =>
  page.$$eval('table tbody tr td:first-child', (cells) =>
    cells.map((c) => c.textContent?.trim() ?? '').filter(Boolean),
  )

/** Two published artists who each own at least one exhibition. */
function twoArtistsWithExhibitions() {
  return prisma.user.findMany({
    where: { userType: { notIn: ['admin', 'superAdmin'] }, exhibitions: { some: {} } },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
    take: 2,
  })
}

/**
 * Open a user's kebab on /admin/users, hit Impersonate, and wait for the
 * dashboard to actually arrive.
 *
 * The wait matters: the banner renders from the updated session while the page
 * is STILL /admin/users, so asserting on the banner alone returns before the
 * navigation and every later assertion races it.
 */
async function impersonate(page: Page, name: string) {
  const row = page.locator('tbody tr', { hasText: name }).first()
  await row.locator('button[aria-label="Actions"]').click()
  const impersonateItem = page.locator('button:has-text("Impersonate")').first()
  await expect(impersonateItem).toBeEnabled()
  await impersonateItem.click()
  await page.waitForURL(/\/dashboard$/)
  await expect(page.getByText(`Viewing as ${name}`)).toBeVisible()
}

test("an impersonated artist never sees another artist's exhibitions", async ({ page }) => {
  // Two full impersonation round-trips plus a deliberately failed request; the
  // 30s default is not enough for the flow, and a timeout here reads as a bug.
  test.setTimeout(120_000)

  const artists = await twoArtistsWithExhibitions()
  test.skip(artists.length < 2, 'needs two artists that each own an exhibition')
  const [first, second] = artists

  // ONE hard load. Everything after is client-side, which is what keeps the
  // Redux store — and therefore the stale list — alive.
  await page.goto('/admin/users')
  await page.waitForLoadState('networkidle')

  await impersonate(page, first.name)
  // Whatever actually renders for the first artist is the contamination to look
  // for later — more honest than guessing which of their exhibitions comes back
  // first from the DB.
  await expect.poll(() => renderedExhibitions(page), { timeout: 15_000 }).not.toHaveLength(0)
  const firstArtistRows = await renderedExhibitions(page)

  // Back to the user list the way a human gets there: by clicking.
  await page.locator('button:has-text("Stop Impersonating")').first().click()
  await page.locator('a[href="/admin/users"]').first().click()
  await page.waitForURL(/\/admin\/users$/)
  await page.waitForLoadState('networkidle')

  // One failed request for the next artist — the flaky network that turns a
  // brief window into a permanently wrong screen.
  await page.route('**/api/exhibitions?userId=*', (route) => route.abort('failed'))

  await impersonate(page, second.name)
  await expect(page.getByText(`Hello ${second.name.split(' ')[0]}`)).toBeVisible()

  // The invariant. Before the fix this kept the FIRST artist's exhibitions on
  // screen indefinitely, while banner and greeting both named the second.
  for (const stale of firstArtistRows) {
    await expect.poll(() => renderedExhibitions(page), { timeout: 8_000 }).not.toContain(stale)
  }
})
