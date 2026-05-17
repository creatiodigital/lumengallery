import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * Shared helpers for the e2e auth flow.
 *
 * The product's login is two-step: (1) email + password posts to
 * `/api/auth/send-login-code`, which generates a random 6-digit code
 * and stamps it on the User row, then (2) the user enters that code
 * to complete sign-in via NextAuth.
 *
 * In e2e we don't have access to the email inbox, so we read the
 * just-generated `loginCode` straight off the DB and continue. This
 * leaves zero production code modified — no test backdoor flag, no
 * fixed magic code — while still exercising the real flow end to end.
 *
 * Env vars (`E2E_ADMIN_EMAIL`, `POSTGRES_PRISMA_URL`, etc.) are loaded
 * via dotenv at the top of `playwright.config.ts`, so they're already
 * present in process.env by the time Prisma initialises here.
 */

export interface E2ECredentials {
  email: string
  password: string
}

export function getAdminCredentials(): E2ECredentials {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing. Set them in .env.test.local (see .env.test.local.example).',
    )
  }
  return { email, password }
}

export function getArtistCredentials(): E2ECredentials {
  const email = process.env.E2E_ARTIST_EMAIL
  const password = process.env.E2E_ARTIST_PASSWORD
  if (!email || !password) {
    throw new Error(
      'E2E_ARTIST_EMAIL / E2E_ARTIST_PASSWORD missing. Set them in .env.test.local (see .env.test.local.example).',
    )
  }
  return { email, password }
}

/**
 * Reads the just-generated `loginCode` for the given email straight
 * off the User row. Polls briefly because send-login-code is async on
 * the server side; usually returns on the first try.
 */
export async function readLoginCodeFromDb(email: string): Promise<string> {
  const start = Date.now()
  // Try for ~5s. The send-login-code endpoint completes quickly but
  // we leave a small buffer so the test isn't flaky on a slow DB.
  while (Date.now() - start < 5000) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { loginCode: true },
    })
    if (user?.loginCode) return user.loginCode
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(
    `No loginCode found in DB for ${email} within 5s — did /api/auth/send-login-code run?`,
  )
}

/**
 * Drives the login UI all the way through, from /dashboard/login to
 * the post-login dashboard. After this returns, the page is logged
 * in and on whatever URL the role redirects to (admins land on
 * /admin/dashboard, artists land on /dashboard).
 */
export async function signInThroughUi(
  page: Page,
  { email, password }: E2ECredentials,
): Promise<void> {
  await page.goto('/dashboard/login')

  // Step 1: email + password → "Continue".
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /^continue$/i }).click()

  // Step 2: handle both auth modes. When `SKIP_LOGIN_OTP=true` is set
  // (local dev convenience), the API returns `{ skipOtp: true }` and
  // the LoginPage signs in directly — no 6-digit prompt, the page
  // navigates straight to the dashboard. When the flag is unset
  // (default, prod parity), the UI advances to the verification step
  // and we read the freshly-issued code from the DB.
  const codeField = page.locator('#loginCode')
  await Promise.race([
    codeField.waitFor({ state: 'visible', timeout: 10_000 }),
    page.waitForURL(/\/(admin\/)?dashboard/, { timeout: 10_000 }),
  ]).catch(() => {
    // Both raced timed out — let the assertion below produce a
    // useful error rather than a generic "racing rejected".
  })

  if (await codeField.isVisible()) {
    const code = await readLoginCodeFromDb(email)
    await codeField.fill(code)
    await page.getByRole('button', { name: /^sign in$/i }).click()
  }

  // Wait for NextAuth to resolve and the client-side redirect to
  // run. We're agnostic about which dashboard URL we land on — the
  // caller asserts that.
  await page.waitForURL(/\/(admin\/)?dashboard/, { timeout: 15_000 })

  // Wait for the session-token cookie to actually be committed
  // before returning. Without this, callers that immediately
  // capture storageState (e.g. globalSetup) get a half-formed
  // cookie jar with only the CSRF token, and any spec that reuses
  // it gets bounced off authenticated routes by the mount-time
  // session guard. NextAuth's JWT cookie name is
  // `authjs.session-token` in dev (no `__Secure-` prefix without HTTPS).
  await expect
    .poll(
      async () => {
        const cookies = await page.context().cookies()
        return cookies.some(
          (c) => c.name === 'authjs.session-token' || c.name === '__Secure-authjs.session-token',
        )
      },
      {
        message: 'NextAuth session cookie should be set after sign-in',
        timeout: 10_000,
      },
    )
    .toBe(true)
}
