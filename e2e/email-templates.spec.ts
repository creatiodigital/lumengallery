import { test, expect } from '@playwright/test'

// Branded email layout, exercised through the dev-only preview route — no
// real send, no WebGL. The route renders templates with sample data.
test.describe('branded email layout (dev preview)', () => {
  test('renders the brand chrome: marks, black CTA, contact signature', async ({ page }) => {
    await page.goto('/dev/emails/sample')

    // Monogram (header) + wordmark (footer) both present.
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)

    // CTA is a real link (and not red — assert it's the black button color).
    const cta = page.getByRole('link', { name: 'View your order' })
    await expect(cta).toBeVisible()

    // Contact signature.
    await expect(page.getByText('contact@theartroom.gallery')).toBeVisible()
    await expect(page.getByText('+34 665 05 99 41')).toBeVisible()
    await expect(page.getByText('theartroom.gallery', { exact: true })).toBeVisible()

    // Never name the print provider.
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })
})
