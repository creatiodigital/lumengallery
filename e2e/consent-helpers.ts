import type { Page } from '@playwright/test'

/**
 * Pre-seed cookie consent so the `CookieBanner` never renders during a test.
 *
 * The banner only shows when `getConsent()` is null (see src/lib/consent.ts),
 * and while it's up it overlays the bottom of the viewport and intercepts
 * pointer events — which silently breaks clicks on anything near the bottom
 * (e.g. a confirm modal's Cancel button).
 *
 * Call this BEFORE `page.goto(...)`: `addInitScript` runs in the page before
 * the app's first script, so consent is already present at first paint and the
 * banner stays hidden. Shape mirrors `ConsentState` in src/lib/consent.ts.
 */
export async function seedCookieConsent(page: Page, analytics = false): Promise<void> {
  await page.addInitScript(
    (value) => {
      window.localStorage.setItem('cookie-consent', value)
    },
    JSON.stringify({ analytics, timestamp: new Date(0).toISOString() }),
  )
}
