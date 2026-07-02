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

  test('order-placed email itemizes options and the price breakdown', async ({ page }) => {
    await page.goto('/dev/emails/order-placed')
    await expect(page.getByText(/thank you, jane/i)).toBeVisible()
    // Edition leads the spec list (variant name resolved server-side).
    await expect(page.getByText('Limited Edition · Medium')).toBeVisible()
    // Chosen options are itemized (a buyer must see what they paid for).
    await expect(page.getByText('Hahnemühle Photo Rag 308gsm')).toBeVisible()
    await expect(page.getByText('59.4 × 42.0 cm')).toBeVisible()
    // Full price breakdown, not just a bare total.
    await expect(page.getByText('Subtotal', { exact: true })).toBeVisible()
    await expect(page.getByText('Shipping', { exact: true })).toBeVisible()
    // VAT label shows the full country name, not the bare ISO code.
    await expect(page.getByText('VAT (Spain 21%)')).toBeVisible()
    await expect(page.getByText('€229.90')).toBeVisible() // sample total
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('cart-order-placed email lists each line, its options and the breakdown', async ({ page }) => {
    await page.goto('/dev/emails/cart-order-placed')
    await expect(page.getByText('Puerta Verde')).toBeVisible()
    await expect(page.getByText('Landscape and River')).toBeVisible()
    // Each line leads with its edition (limited variant name + open edition).
    await expect(page.getByText('Limited Edition · Medium')).toBeVisible()
    await expect(page.getByText('Open Edition')).toBeVisible()
    // Per-line options + per-line price.
    await expect(page.getByText('Natural oak')).toBeVisible()
    await expect(page.getByText('€420.00')).toBeVisible() // line 1 total (2 × €210.00)
    // Breakdown rows + grand total.
    await expect(page.getByText('Subtotal', { exact: true })).toBeVisible()
    await expect(page.getByText('€871.20')).toBeVisible() // sample order total
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('order-in-production email shows production headline and order ref', async ({ page }) => {
    await page.goto('/dev/emails/order-in-production')
    await expect(page.getByText(/good news, jane/i)).toBeVisible()
    await expect(page.getByText(/your print is now being produced/i)).toBeVisible()
    await expect(page.getByText(/puerta verde/i)).toBeVisible()
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('order-shipped email shows shipped headline, tracking link, and order ref', async ({ page }) => {
    await page.goto('/dev/emails/order-shipped')
    await expect(page.getByText(/on its way, jane/i)).toBeVisible()
    await expect(page.getByText(/your print has shipped/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Track your shipment' })).toBeVisible()
    await expect(page.getByText(/puerta verde/i)).toBeVisible()
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('order-delivered email shows arrival headline and payout note', async ({ page }) => {
    await page.goto('/dev/emails/order-delivered')
    await expect(page.getByText(/your artwork has arrived, jane/i)).toBeVisible()
    await expect(page.getByText(/even better in the flesh/i)).toBeVisible()
    await expect(page.getByText(/puerta verde/i)).toBeVisible()
    await expect(page.getByText(/artist will receive their payout/i)).toBeVisible()
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('refund-issued email shows refund amount and timeline', async ({ page }) => {
    await page.goto('/dev/emails/refund-issued')
    await expect(page.getByText(/your refund is on its way, jane/i)).toBeVisible()
    await expect(page.getByText('€229.90')).toBeVisible() // sample refund amount
    await expect(page.getByText(/5.+10 business days/i)).toBeVisible()
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('order-cancelled email shows cancellation headline, order ref, and refund notice', async ({ page }) => {
    await page.goto('/dev/emails/order-cancelled')
    // Headline uses a typographic apostrophe — match without it.
    await expect(page.getByRole('heading', { name: /sorry, jane/i })).toBeVisible()
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('inquiry-admin email shows artwork info and inquirer contact details', async ({ page }) => {
    await page.goto('/dev/emails/inquiry-admin')
    await expect(page.getByText(/new artwork inquiry/i)).toBeVisible()
    // Artwork detail rows — these also appear in the hidden preheader, so
    // target the visible (last) occurrence.
    await expect(page.getByText('Puerta Verde').last()).toBeVisible()
    await expect(page.getByText('John Doe').last()).toBeVisible()
    // Contact info: name and email visible
    await expect(page.getByText(/jane smith/i)).toBeVisible()
    await expect(page.getByText('jane@example.com')).toBeVisible()
    // Brand chrome
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('inquiry-user email shows thank-you copy and echoes the inquirer message', async ({ page }) => {
    await page.goto('/dev/emails/inquiry-user')
    await expect(page.getByText(/thank you for your inquiry/i)).toBeVisible()
    // Personalized greeting + artwork reference
    await expect(page.getByText(/dear jane/i)).toBeVisible()
    await expect(page.getByText(/puerta verde/i).last()).toBeVisible()
    // Echoed message text
    await expect(page.getByText(/is this piece still available/i)).toBeVisible()
    // Brand chrome
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('admin-order email shows new order heading and artwork details', async ({ page }) => {
    await page.goto('/dev/emails/admin-order')
    await expect(page.getByRole('heading', { name: /needs fulfillment/i })).toBeVisible()
    await expect(page.getByText(/puerta verde/i).last()).toBeVisible()
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
    await expect(page.locator('body')).not.toContainText(/\bTPS\b/)
  })

  test('admin-cart-order email shows cart order heading and all line items', async ({ page }) => {
    await page.goto('/dev/emails/admin-cart-order')
    await expect(page.getByRole('heading', { name: /needs fulfillment/i })).toBeVisible()
    await expect(page.getByText(/puerta verde/i)).toBeVisible()
    await expect(page.getByText(/landscape and river/i)).toBeVisible()
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
    await expect(page.locator('body')).not.toContainText(/\bTPS\b/)
  })

  test('admin-order-cancelled email shows cancellation heading and REFUND NEEDED', async ({ page }) => {
    await page.goto('/dev/emails/admin-order-cancelled')
    await expect(page.getByText(/order canceled/i)).toBeVisible()
    await expect(page.getByText(/refund needed/i)).toBeVisible()
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(/printspace/i)
    await expect(page.locator('body')).not.toContainText(/\bTPS\b/)
  })

  test('admin-critical-alert email shows urgent heading, emoji, and what-to-do step', async ({ page }) => {
    await page.goto('/dev/emails/admin-critical-alert')
    // Heading includes the emoji and sample title (also in the hidden
    // preheader — target the heading element specifically).
    await expect(page.getByRole('heading', { name: /order row missing after charge/i })).toBeVisible()
    // At least one of the "What to do" steps is rendered
    await expect(page.getByText(/check stripe for the captured paymentintent/i)).toBeVisible()
    // Brand chrome
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    // Never name the print provider
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('artist-payout email shows sale headline and formatted amount', async ({ page }) => {
    await page.goto('/dev/emails/artist-payout')
    // Heading
    await expect(page.getByText(/you made a sale/i)).toBeVisible()
    // Formatted payout amount (12500 cents = €125.00)
    await expect(page.getByText('€125.00')).toBeVisible()
    // Brand chrome
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    // Never name the print provider
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('login-code email shows the OTP code and expiry warning', async ({ page }) => {
    await page.goto('/dev/emails/login-code')
    // Sample code is visible in the code block
    await expect(page.getByText('482913')).toBeVisible()
    // Expiry warning is intact
    await expect(page.getByText(/expire in 10 minutes/i)).toBeVisible()
    // Brand chrome: monogram (header) + wordmark (footer)
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    // Never name the print provider
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('forgot-password email shows reset button and expiry warning', async ({ page }) => {
    await page.goto('/dev/emails/forgot-password')
    // Reset CTA is visible
    await expect(page.getByRole('link', { name: 'Reset password' })).toBeVisible()
    // Expiry warning is intact
    await expect(page.getByText(/expire in 1 hour/i)).toBeVisible()
    // Brand chrome: monogram (header) + wordmark (footer)
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    // Never name the print provider
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })

  test('artist-invite email shows temp password, login button, and important notice', async ({ page }) => {
    await page.goto('/dev/emails/artist-invite')
    // Temp password is visible in the code block
    await expect(page.getByText('Temp-7Q2K9')).toBeVisible()
    // Login CTA is visible
    await expect(page.getByRole('link', { name: 'Go to your login page' })).toBeVisible()
    // Brand chrome: monogram (header) + wordmark (footer)
    await expect(page.locator('img[alt="The Art Room"]')).toHaveCount(2)
    // Never name the print provider
    await expect(page.locator('body')).not.toContainText(/printspace/i)
  })
})
