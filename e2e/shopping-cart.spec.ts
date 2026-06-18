import { test, expect } from '@playwright/test'

import { makeCartItem, seedCart } from './cart-helpers'
import { seedCookieConsent } from './consent-helpers'

/**
 * Shopping cart — the `/cart` page and its many conditional behaviours, driven
 * entirely off a localStorage-seeded cart (see cart-helpers). The print wizard
 * is NEVER mounted, so no R3F/Three.js WebGL runs in these tests.
 *
 * What this DOES cover (all cart-page logic): rendering, quantity stepper,
 * the qty-1 "minus becomes trash → confirm" remove flow, the Edit-item deep
 * link, the spec-list show-all toggle, distinct-config lines + totals, the
 * units-based badge count, and the limited-edition hold countdown + info tip.
 *
 * What this does NOT cover (lives in the wizard, which is WebGL and off-limits
 * here): the add-time merge of identical configs, the "Add anyway" duplicate
 * modal, and the edit-replace quantity carry. Those are exercised manually /
 * left for a non-WebGL harness; this spec deliberately stops at the cart.
 */

test.beforeEach(async ({ page }) => {
  // Keep the cookie banner from overlaying the confirm modal's buttons.
  await seedCookieConsent(page)
})

test.describe('shopping cart — /cart page', () => {
  test('empty cart shows the empty state and a link to browse prints', async ({ page }) => {
    await seedCart(page, [])
    await page.goto('/cart')

    await expect(page.getByText('Your cart is empty')).toBeVisible()
    await expect(page.getByRole('link', { name: /browse prints/i })).toBeVisible()
  })

  test('renders a seeded line with its specs, edition tag and price', async ({ page }) => {
    await seedCart(page, [makeCartItem({ lineId: 'line-1' })])
    await page.goto('/cart')

    await expect(page.getByText('John Doe')).toBeVisible()
    await expect(page.getByText('Landscape and River')).toBeVisible()
    await expect(page.getByText('Open Edition')).toBeVisible()
    await expect(page.getByText('Giclée')).toBeVisible()
    await expect(page.getByText('Hahnemühle German Etching')).toBeVisible()

    // €100.00 unit (qty 1) shows as both the line's Total Price and the Subtotal.
    await expect(page.getByText('€100.00')).toHaveCount(2)
  })

  test('quantity stepper bumps the line total and subtotal', async ({ page }) => {
    await seedCart(page, [makeCartItem({ lineId: 'line-1' })])
    await page.goto('/cart')

    await expect(page.getByText('€100.00')).toHaveCount(2)

    await page.getByRole('button', { name: 'Increase quantity' }).click()
    // qty 2 → line + subtotal both €200.00, and the old €100.00 is gone.
    await expect(page.getByText('€200.00')).toHaveCount(2)
    await expect(page.getByText('€100.00')).toHaveCount(0)

    await page.getByRole('button', { name: 'Decrease quantity' }).click()
    await expect(page.getByText('€100.00')).toHaveCount(2)
  })

  test('at quantity 1 the minus is a trash that confirms before removing', async ({ page }) => {
    await seedCart(page, [makeCartItem({ lineId: 'line-1' })])
    await page.goto('/cart')

    // At the floor there is no "decrease" control — it's a remove affordance.
    await expect(page.getByRole('button', { name: 'Decrease quantity' })).toHaveCount(0)
    const remove = page.getByRole('button', { name: 'Remove item' })
    await expect(remove).toBeVisible()

    // Clicking it asks to confirm — it does NOT silently drop to a 0-qty line.
    await remove.click()
    await expect(page.getByText('Remove print?')).toBeVisible()

    // Cancel keeps the line.
    await page.getByRole('button', { name: /^cancel$/i }).click()
    await expect(page.getByText('Remove print?')).toHaveCount(0)
    await expect(page.getByText('Landscape and River')).toBeVisible()

    // Confirming removes it → empty cart.
    await remove.click()
    await page.getByRole('button', { name: /^remove$/i }).click()
    await expect(page.getByText('Your cart is empty')).toBeVisible()
  })

  test('Edit item deep-links to the wizard with the line config and id', async ({ page }) => {
    await seedCart(page, [
      makeCartItem({
        lineId: 'line-42',
        config: { values: { paper: 'german-etching', size: 'a4' } },
      }),
    ])
    await page.goto('/cart')

    const href = await page.getByRole('link', { name: /edit item/i }).getAttribute('href')
    expect(href).toContain('/artworks/landscape-and-river-52416/print?')
    expect(href).toContain('editLineId=line-42')
    // The config rides along so the wizard re-hydrates the exact selection.
    expect(href).toContain('paper=german-etching')
  })

  test('the spec list hides extra options behind a show-all toggle', async ({ page }) => {
    await seedCart(page, [
      makeCartItem({
        lineId: 'line-1',
        specsSummary: [
          { id: 'printType', label: 'Print type', value: 'Giclée' },
          { id: 'paper', label: 'Paper', value: 'Hahnemühle German Etching' },
          { id: 'size', label: 'Print size', value: '30 × 20 cm' },
          { id: 'border', label: 'Paper border', value: '3 cm' },
          { id: 'frame', label: 'Frame', value: 'Oak' },
          { id: 'glazing', label: 'Glazing', value: 'Museum glass' },
        ],
      }),
    ])
    await page.goto('/cart')

    const toggle = page.getByRole('button', { name: /show all selected options/i })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // The 6th spec is hidden until expanded.
    await expect(page.getByText('Museum glass')).toHaveCount(0)

    await toggle.click()
    await expect(page.getByRole('button', { name: /show less/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(page.getByText('Museum glass')).toBeVisible()
  })

  test('two distinct configurations are separate lines and the subtotal sums them', async ({
    page,
  }) => {
    await seedCart(page, [
      makeCartItem({ lineId: 'line-1', config: { values: { size: 'a4' } } }),
      makeCartItem({
        lineId: 'line-2',
        title: 'Green Door',
        artworkSlug: 'green-door-12345',
        config: { values: { size: 'a3' } },
        unitArtistCents: 9000,
        unitProductionCents: 4000,
        unitGalleryCents: 2000, // €150.00
      }),
    ])
    await page.goto('/cart')

    await expect(page.getByText('Landscape and River')).toBeVisible()
    await expect(page.getByText('Green Door')).toBeVisible()
    // Subtotal = €100.00 + €150.00.
    await expect(page.getByText('€250.00')).toBeVisible()
  })

  test('the header cart badge counts total units, not lines', async ({ page }) => {
    // One line at quantity 2 → the badge reads "2" (units), per cartCount.
    await seedCart(page, [makeCartItem({ lineId: 'line-1', quantity: 2 })])
    await page.goto('/prints')

    await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible()
  })

  test('a limited line shows the hold countdown with an info tooltip', async ({ page }) => {
    await seedCart(page, [
      makeCartItem({
        lineId: 'line-ltd',
        editionType: 'limited',
        variantId: 'variant-1',
        editionNumberIds: ['en-1'],
        holdExpiresAt: Date.now() + 12 * 60 * 1000,
      }),
    ])
    await page.goto('/cart')

    await expect(page.getByText('Limited Edition')).toBeVisible()
    const hold = page.getByText(/Held for you —/)
    await expect(hold).toBeVisible()

    // The info icon explains the hold on hover.
    const box = hold.locator('..')
    await box.locator('svg').hover()
    await expect(page.getByRole('tooltip')).toContainText(/reserved while you decide/i)
  })
})
