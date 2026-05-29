import { test, expect, type Page } from '@playwright/test'

/**
 * Cookie consent + GA4 Consent Mode gating.
 *
 * The consent-storage assertions always run. The gtag/Consent-Mode
 * assertions only run when GA is actually loaded on the page (i.e. when
 * NEXT_PUBLIC_GA_MEASUREMENT_ID was set on the server). In the default e2e
 * run GA isn't configured, so those assertions are skipped rather than
 * failing — run with NEXT_PUBLIC_GA_MEASUREMENT_ID set to exercise them.
 */

const CONSENT_KEY = 'cookie-consent'

// Reads window.dataLayer and reports whether GA is loaded and whether
// analytics_storage was granted via a Consent Mode `update`.
const readConsentState = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      gtag?: unknown
      dataLayer?: Array<Record<number, unknown>>
    }
    const dataLayer = w.dataLayer ?? []
    const granted = dataLayer.some(
      (entry) =>
        entry &&
        entry[0] === 'consent' &&
        entry[1] === 'update' &&
        (entry[2] as { analytics_storage?: string })?.analytics_storage === 'granted',
    )
    return { gaLoaded: typeof w.gtag === 'function', granted }
  })

const readStoredConsent = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), CONSENT_KEY)

test.describe('Cookie consent', () => {
  test.beforeEach(async ({ context }) => {
    // Never reach real Google endpoints from a test. Each test already runs
    // in a fresh, isolated context, so localStorage starts empty.
    await context.route(/googletagmanager\.com|google-analytics\.com/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
    )
  })

  test('shows on first visit; Accept stores consent and grants analytics', async ({ page }) => {
    await page.goto('/prints')
    const banner = page.getByRole('region', { name: 'Cookie consent' })
    await expect(banner).toBeVisible()

    expect(await readStoredConsent(page)).toBeNull()

    await page.getByRole('button', { name: 'Accept analytics cookies' }).click()
    await expect(banner).toBeHidden()

    expect((await readStoredConsent(page)).analytics).toBe(true)

    // When GA is configured, accepting must grant analytics_storage.
    const { gaLoaded, granted } = await readConsentState(page)
    if (gaLoaded) expect(granted).toBe(true)
  })

  test('Decline stores consent without granting analytics', async ({ page }) => {
    await page.goto('/prints')
    await page.getByRole('button', { name: 'Decline analytics cookies' }).click()

    expect((await readStoredConsent(page)).analytics).toBe(false)

    const { granted } = await readConsentState(page)
    expect(granted).toBe(false)
  })

  test('decision persists across reloads', async ({ page }) => {
    await page.goto('/prints')
    await page.getByRole('button', { name: 'Accept analytics cookies' }).click()
    await expect(page.getByRole('region', { name: 'Cookie consent' })).toBeHidden()

    await page.reload()
    await expect(page.getByRole('region', { name: 'Cookie consent' })).toBeHidden()

    // A returning visitor who accepted is granted on load, before any click.
    const { gaLoaded, granted } = await readConsentState(page)
    if (gaLoaded) expect(granted).toBe(true)
  })

  test('footer "Cookie Settings" re-opens the banner', async ({ page }) => {
    await page.goto('/prints')
    await page.getByRole('button', { name: 'Decline analytics cookies' }).click()
    await expect(page.getByRole('region', { name: 'Cookie consent' })).toBeHidden()

    await page.getByRole('button', { name: 'Cookie Settings' }).click()
    await expect(page.getByRole('region', { name: 'Cookie consent' })).toBeVisible()
  })
})
