import { test, expect } from '@playwright/test'

import { seedCookieConsent } from './consent-helpers'

/**
 * Destructive deletes are gated by an in-app confirm dialog — never a native
 * `window.confirm()`. Verified on the artist's artwork list (the dashboard
 * "Delete" → "Delete Artwork?" flow).
 *
 * Non-destructive by construction: the test only ever clicks Cancel, never
 * "Yes, Delete", so no artwork is removed. It also asserts that NO native
 * dialog event fires — the whole point of the alert()/confirm() cleanup.
 *
 * Assumes the e2e artist account has at least one artwork (it does — the
 * artist-flow suite relies on the same seeded account).
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

test('a destructive delete is gated by an in-app dialog, not a native confirm', async ({
  page,
}) => {
  // Keep the cookie banner from overlaying the modal's Cancel button.
  await seedCookieConsent(page)
  await page.goto('/dashboard/artworks')

  // A native window.confirm()/alert() would surface as a 'dialog' event.
  let nativeDialogFired = false
  page.on('dialog', (d) => {
    nativeDialogFired = true
    d.dismiss().catch(() => {})
  })

  const deleteButton = page.getByRole('button', { name: /^delete$/i }).first()
  await expect(deleteButton, 'artist should have at least one deletable artwork').toBeVisible()
  await deleteButton.click()

  // The delete is gated by an in-app confirmation, not a native bubble.
  await expect(page.getByText('Delete Artwork?')).toBeVisible()
  expect(nativeDialogFired, 'no native confirm()/alert() should be used').toBe(false)

  // Cancel dismisses it without deleting anything (we never click "Yes, Delete").
  await page.getByRole('button', { name: /^cancel$/i }).click()
  await expect(page.getByText('Delete Artwork?')).toHaveCount(0)
})
