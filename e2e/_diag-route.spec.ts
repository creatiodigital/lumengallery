import { test } from '@playwright/test'

import { seedCookieConsent } from './consent-helpers'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

test.use({ storageState: 'e2e/.auth/admin.json' })

test('diagnostic: what does a server-action POST body actually look like', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  try {
    await page.route('**/admin/content/gallery-selection', async (route) => {
      const req = route.request()
      if (req.method() === 'POST') {
        const body = req.postData() || ''
        console.log('DIAG POST body length:', body.length)
        console.log('DIAG contains "artistId":', body.includes('artistId'))
        console.log(
          'DIAG contains fx.artworkId owner-ish uuid pattern present?',
          /[0-9a-f-]{36}/.test(body),
        )
        console.log('DIAG first 800 chars:', body.slice(0, 800))
      }
      await route.continue()
    })

    await seedCookieConsent(page)
    await page.goto('/admin/content/gallery-selection')
    await page.getByRole('button', { name: 'Add artworks' }).click()
    await page.getByPlaceholder('Search artists').fill('John')
    await page.getByRole('button', { name: /John Doe/ }).click()
    await page.waitForTimeout(1500)
  } finally {
    await teardownLimitedFixture(fx)
  }
})
