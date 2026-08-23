import { test, expect } from '@playwright/test'

import { makeCartItem, seedCart } from './cart-helpers'
import { seedCookieConsent } from './consent-helpers'

/**
 * The checkout address step's two helping hands: the shipping-countries list,
 * and the warning that we print whatever is typed onto the parcel label.
 *
 * Google Places itself is NOT exercised here. The suite runs with no
 * GOOGLE_MAPS_API_KEY, so the checkout page resolves `addressAutocomplete` to
 * false server-side and the field is the plain manual input — precisely the
 * path most worth pinning, because it is what every buyer gets if the key is
 * ever missing, the route is throttled, or Google is down. A dead autocomplete
 * must never be able to stop someone buying a print.
 *
 * Reached by seeding the cart into localStorage — no wizard, so no WebGL.
 */

async function openCheckout(page: import('@playwright/test').Page) {
  await seedCookieConsent(page)
  await seedCart(page, [makeCartItem({ lineId: 'line-address-help' })])
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: /where should we send it\?/i })).toBeVisible()
}

test('without a Maps key the address field is the plain input, and checkout still works', async ({
  page,
}) => {
  await openCheckout(page)

  const address = page.locator('#address1')
  await expect(address).toBeVisible()
  // Degraded mode is the ordinary input: no combobox, and no escape hatch to
  // offer because there is nothing to escape from.
  await expect(address).not.toHaveAttribute('role', 'combobox')
  await expect(page.getByRole('button', { name: /enter address manually/i })).toHaveCount(0)

  // And it is still a working form: typing an address and continuing advances.
  await page.locator('#fullName').fill('John Doe')
  await page.locator('#email').fill('john.doe@example.com')
  await page.locator('#phone').fill('+34 600 000 000')
  await address.fill('Calle de Serrano 21')
  await page.locator('#city').fill('Madrid')
  await page.locator('#postalCode').fill('28001')
  await expect(address).toHaveValue('Calle de Serrano 21')
})

test('with no Maps key, Chrome autofill keeps its normal tokens on every field', async ({
  page,
}) => {
  await openCheckout(page)

  // Degraded mode must not cost the buyer their browser autofill. This is the
  // state most buyers are in whenever the key is missing, blocked or rejected,
  // and silently disabling autofill there would be a pure regression.
  await expect(page.locator('#address1')).toHaveAttribute('autocomplete', 'address-line1')
  await expect(page.locator('#city')).toHaveAttribute('autocomplete', 'address-level2')
  await expect(page.locator('#state')).toHaveAttribute('autocomplete', 'address-level1')
  await expect(page.locator('#postalCode')).toHaveAttribute('autocomplete', 'postal-code')

  // Identity fields are never suppressed in either mode — nothing of ours
  // competes with them, and they are what a returning buyer wants filled.
  await expect(page.locator('#fullName')).toHaveAttribute('autocomplete', 'name')
  await expect(page.locator('#email')).toHaveAttribute('autocomplete', 'email')
  await expect(page.locator('#phone')).toHaveAttribute('autocomplete', 'tel')
})

test('the lookup route never leaks the key, and refuses unknown requests', async ({ request }) => {
  // The whole point of proxying through our own server is that the Maps key
  // stays here. With none configured the route reports itself disabled rather
  // than erroring, which is what puts the buyer on the manual form.
  const disabled = await request.post('/api/checkout/address-lookup', {
    data: { kind: 'suggest', input: 'Calle de Serrano', countryCode: 'ES', sessionToken: 'x' },
  })
  expect(disabled.ok()).toBe(true)
  const body = await disabled.json()
  expect(body).toEqual({ ok: false, reason: 'disabled' })

  // Whatever it answers, it must never echo a key back to the caller.
  expect(JSON.stringify(body)).not.toMatch(/AIza/)

  // An unrecognised body is refused rather than passed to Google.
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
