import { test, expect } from '@playwright/test'

import { makeCartItem, seedCart } from './cart-helpers'
import { seedCookieConsent } from './consent-helpers'

/**
 * The checkout address step's two helping hands: the shipping-countries list,
 * and the warning that we print whatever is typed onto the parcel label.
 *
 * These run in BOTH modes, deliberately.
 *
 * Whether autocomplete exists is decided server-side from GOOGLE_MAPS_API_KEY,
 * which the suite cannot set — so a spec that assumed one mode passed or failed
 * depending on whether the developer running it happened to have a key. It did
 * exactly that the first time someone added one.
 *
 * So the invariants (checkout works, the warning is shown, the modal works, the
 * route never leaks a key) are asserted unconditionally, and only the
 * mode-specific parts branch — each branch being the correct behaviour for that
 * mode. Whichever way the environment is configured, one of them is exercised.
 *
 * Reached by seeding the cart into localStorage — no wizard, so no WebGL.
 */

/** True when a Maps key is configured, i.e. the page will offer suggestions.
 *  playwright.config loads .env.local into the runner, so this sees the same
 *  value the dev server does. */
const autocompleteEnabled = Boolean(process.env.GOOGLE_MAPS_API_KEY)

async function openCheckout(page: import('@playwright/test').Page) {
  await seedCookieConsent(page)
  await seedCart(page, [makeCartItem({ lineId: 'line-address-help' })])
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: /where should we send it\?/i })).toBeVisible()
}

test('the address field matches the configured mode, and checkout works either way', async ({
  page,
}) => {
  await openCheckout(page)

  const address = page.locator('#address1')
  await expect(address).toBeVisible()

  if (autocompleteEnabled) {
    // Suggestions available: the field is a combobox and offers the way out.
    await expect(address).toHaveAttribute('role', 'combobox')
    await expect(page.getByRole('button', { name: /enter address manually/i })).toBeVisible()
  } else {
    // Degraded: an ordinary input, and no escape hatch because there is
    // nothing to escape from.
    await expect(address).not.toHaveAttribute('role', 'combobox')
    await expect(page.getByRole('button', { name: /enter address manually/i })).toHaveCount(0)
  }

  // The invariant that matters in both modes: it is still a working form.
  await page.locator('#fullName').fill('John Doe')
  await page.locator('#email').fill('john.doe@example.com')
  await page.locator('#phone').fill('+34 600 000 000')
  await address.fill('Calle de Serrano 21')
  await page.locator('#city').fill('Madrid')
  await page.locator('#postalCode').fill('28001')
  await expect(address).toHaveValue('Calle de Serrano 21')
})

test('Chrome autofill is suppressed on the address block only while WE own it', async ({
  page,
}) => {
  await openCheckout(page)

  // Chrome ignores autocomplete="off", so suppression uses a token it does not
  // recognise. It covers the whole address block, never just the street —
  // suppressing the street alone leaves Chrome filling city and postcode while
  // the street stays blank.
  const suffix = autocompleteEnabled ? '-search' : ''
  await expect(page.locator('#address1')).toHaveAttribute(
    'autocomplete',
    autocompleteEnabled ? 'address-line1-search' : 'address-line1',
  )
  await expect(page.locator('#city')).toHaveAttribute('autocomplete', `address-level2${suffix}`)
  await expect(page.locator('#state')).toHaveAttribute('autocomplete', `address-level1${suffix}`)
  await expect(page.locator('#postalCode')).toHaveAttribute('autocomplete', `postal-code${suffix}`)

  // Identity fields are never suppressed in either mode — nothing of ours
  // competes with them, and they are what a returning buyer wants filled.
  await expect(page.locator('#fullName')).toHaveAttribute('autocomplete', 'name')
  await expect(page.locator('#email')).toHaveAttribute('autocomplete', 'email')
  await expect(page.locator('#phone')).toHaveAttribute('autocomplete', 'tel')
})

test('the lookup route never leaks the key, and refuses unknown requests', async ({ request }) => {
  const res = await request.post('/api/checkout/address-lookup', {
    data: { kind: 'suggest', input: 'Calle de Serrano', countryCode: 'ES', sessionToken: 'e2e' },
  })
  expect(res.ok()).toBe(true)
  const body = await res.json()

  if (autocompleteEnabled) {
    // Configured: real suggestions, and the key stays on the server.
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.suggestions)).toBe(true)
  } else {
    // Not configured is a normal state, reported as such rather than as an
    // error — that is what puts the buyer on the manual form.
    expect(body).toEqual({ ok: false, reason: 'disabled' })
  }

  // The point of proxying at all: whatever it answers, no key ever comes back.
  expect(JSON.stringify(body)).not.toMatch(/AIza/)

  // An unrecognised body is refused rather than forwarded to Google.
  const junk = await request.post('/api/checkout/address-lookup', { data: { kind: 'nonsense' } })
  expect((await junk.json()).ok).toBe(false)
})

test('the address warning states we print exactly what was entered', async ({ page }) => {
  await openCheckout(page)

  // Sits at the point of commitment, next to the submit control — not at the
  // top of the form, where it would be read before there is anything to check.
  await expect(page.getByText(/please double-check your address/i)).toBeVisible()
  await expect(page.getByText(/exactly as entered/i)).toBeVisible()
})

test('"Where we ship" opens over checkout, and picking a country fills the form', async ({
  page,
}) => {
  await openCheckout(page)

  // Type into the form FIRST — the whole point of a modal here is that a buyer
  // asking "do you even ship to me?" does not lose a half-filled checkout.
  await page.locator('#fullName').fill('John Doe')

  await page.getByRole('button', { name: /where we ship/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // The dialog is announced by name, not as an anonymous "dialog" — which
  // means Modal's aria-labelledby actually resolves to the heading.
  await expect(dialog).toHaveAccessibleName(/where we ship/i)
  await expect(dialog.getByRole('heading', { name: /where we ship/i })).toBeVisible()
  // The kind sign-off, so a buyer whose country is absent is not just refused.
  await expect(dialog.getByText(/adding new delivery countries/i)).toBeVisible()

  // Spain is on the list; choosing it sets the country and closes the dialog.
  await dialog.getByRole('button', { name: 'Spain', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Nothing behind the modal was disturbed.
  await expect(page.locator('#fullName')).toHaveValue('John Doe')
  await expect(page.getByText('Spain')).toBeVisible()
})
