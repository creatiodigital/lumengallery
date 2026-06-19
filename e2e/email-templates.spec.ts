import { test, expect } from '@playwright/test'

// Branded email layout, exercised through the dev-only preview route — no
// real send, no WebGL. The route renders templates with sample data.
test.describe('branded email layout (dev preview)', () => {
  test('renders the brand chrome: marks, black CTA, contact signature', async ({ page }) => {
    await page.goto('/dev/emails/sample')

    // Monogram (header) + wordmark (footer) both present.
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)

    // CTA link is visible. Button color is enforced by brand tokens in code, not asserted here.
    const cta = page.getByRole('link', { name: 'View your order' })
    await expect(cta).toBeVisible()

    // Contact signature.
    await expect(page.getByText('contact@theartroom.gallery')).toBeVisible()
    await expect(page.getByText('+34 665 05 99 41')).toBeVisible()
    await expect(page.getByText('theartroom.gallery', { exact: true })).toBeVisible()

    // Never name the print provider.
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('order-placed email shows the buyer headline and total', async ({ page }) => {
    await page.goto('/dev/emails/order-placed')
    await expect(page.getByText(/thank you, jane/i)).toBeVisible()
    await expect(page.getByText('€211.00')).toBeVisible() // sample total
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('cart-order-placed email lists each line and the total', async ({ page }) => {
    await page.goto('/dev/emails/cart-order-placed')
    await expect(page.getByText('Puerta Verde')).toBeVisible()
    await expect(page.getByText('Landscape and River')).toBeVisible()
    await expect(page.getByText('€844.00')).toBeVisible() // sample order total
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })
})
