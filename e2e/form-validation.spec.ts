import { test, expect } from '@playwright/test'

import { fixtures, routes } from './fixtures'

/**
 * Shared form-validation system — exercised through the public InquireSidebar
 * (the inquiry form on every artwork page). Chosen because it's reachable
 * without auth and without mounting the WebGL print wizard, yet it runs the
 * full house validation flow on the shared layer:
 *   - `useFormValidation` hook (silent on arrival → all errors on submit →
 *     each error clears live as the user fixes that field)
 *   - shared validators (`email()`, `phone()`, `minLength()`)
 *   - the single `ErrorText` component for every message
 *   - `noValidate` on the <form> so the browser never shows a native bubble
 *
 * Every test here keeps at least one field invalid, so the form NEVER submits
 * to /api/inquire — no inquiry email is ever sent by this spec.
 */

const SEND = /send inquiry/i

// Open the inquiry sidebar on the fixture artwork page and wait for the form.
async function openInquiry(page: import('@playwright/test').Page) {
  await page.goto(routes.artwork(fixtures.artworkSlug))
  await page.getByRole('button', { name: /inquire/i }).click()
  await expect(page.getByRole('button', { name: SEND })).toBeVisible()
}

test.describe('form validation — shared system (InquireSidebar)', () => {
  test('submitting empty shows every required error, with native validation off', async ({
    page,
  }) => {
    await openInquiry(page)

    // `noValidate` is present, so the browser suppresses its own bubbles and
    // our JS handler runs instead. (The fact that all custom errors below
    // appear at once is the functional proof; this is the explicit check.)
    const form = page.locator('form', { has: page.getByRole('button', { name: SEND }) })
    await expect(form).toHaveJSProperty('noValidate', true)

    await page.getByRole('button', { name: SEND }).click()

    // House flow: silent until the first submit, then ALL errors appear.
    await expect(page.getByText('Please enter your first name.')).toBeVisible()
    await expect(page.getByText('Please enter your last name.')).toBeVisible()
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Please enter a valid phone number.')).toBeVisible()
    await expect(page.getByText('Please enter a message of at least 10 characters.')).toBeVisible()

    // No native browser validation bubble swallowed the submit: the sidebar is
    // still open (the form did not navigate / submit).
    await expect(page.getByRole('button', { name: SEND })).toBeVisible()
  })

  test('rejects a malformed email', async ({ page }) => {
    await openInquiry(page)

    // Only the email is filled (with a malformed value) — other fields stay
    // empty so the form can never submit. This isolates the email-format rule.
    await page.getByLabel('Email').fill('notanemail')
    await page.getByRole('button', { name: SEND }).click()

    await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
  })

  test('rejects an invalid phone number', async ({ page }) => {
    await openInquiry(page)

    await page.getByLabel('Phone').fill('123') // too few digits
    await page.getByRole('button', { name: SEND }).click()

    await expect(page.getByText('Please enter a valid phone number.')).toBeVisible()
  })

  test('clears a field error live once it is corrected', async ({ page }) => {
    await openInquiry(page)

    // Trigger the full error set.
    await page.getByRole('button', { name: SEND }).click()
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible()

    // Correcting just the email clears its message in place...
    await page.getByLabel('Email').fill('jane@example.com')
    await expect(page.getByText('Please enter a valid email address.')).toHaveCount(0)

    // ...while a still-empty field keeps its error (no full re-validation).
    await expect(page.getByText('Please enter your first name.')).toBeVisible()
  })
})
