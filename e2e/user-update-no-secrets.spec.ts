import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * Saving a profile must not hand the caller the account's credentials.
 *
 * `PUT /api/users/[id]` called `prisma.user.update` with no `select`, then
 * returned the row whole. That shipped the bcrypt hash, the plaintext
 * `magicLinkToken` (a live password-reset credential), the plaintext six-digit
 * `loginCode`, and the Stripe account id — on every save, including the
 * "Set as Featured" toggle in the admin user list.
 *
 * The sharpest chain defeats email login without touching the victim's mailbox:
 * POST their address to the unauthenticated `send-login-code`, which writes the
 * plaintext code to their row, then fire a no-op PUT and read `loginCode`
 * straight out of the 200 body.
 *
 * The quieter and likelier harm needs no attacker at all: routine admin actions
 * put live credentials for the whole user table into devtools network history
 * and extension-readable page memory.
 *
 * The codebase already states this rule at `api/artists/route.ts` — "Never
 * return the full row — it carries the password hash and the login/reset secret
 * columns." This was the one route that broke it.
 */

const SECRET_COLUMNS = [
  'password',
  'magicLinkToken',
  'magicLinkExpiry',
  'loginCode',
  'loginCodeExpiry',
  'stripeAccountId',
  'totpSecret',
] as const

test.use({ storageState: 'e2e/.auth/admin.json' })

test('updating a profile never returns credential columns', async ({ request }) => {
  const stamp = Date.now().toString(36)

  // A throwaway artist carrying every secret the leak would have exposed, so
  // their absence from the response is meaningful rather than incidental.
  const user = await prisma.user.create({
    data: {
      name: 'E2E Secret',
      lastName: 'Leak Probe',
      biography: 'E2E throwaway.',
      email: `e2e-secret-${stamp}@example.com`,
      handler: `e2e-secret-${stamp}`,
      userType: 'artist',
      password: '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR',
      magicLinkToken: `e2e-reset-token-${stamp}`,
      magicLinkExpiry: new Date(Date.now() + 3_600_000),
      loginCode: '424242',
      loginCodeExpiry: new Date(Date.now() + 600_000),
    },
    select: { id: true },
  })

  try {
    // A no-op-ish save, exactly like the admin "Set as Featured" toggle.
    const res = await request.put(`/api/users/${user.id}`, {
      data: { isFeatured: true },
    })
    expect(res.ok(), `update failed: ${res.status()}`).toBe(true)

    const body = await res.json()

    // Positive control: the update really happened and we are reading the right
    // row, so a missing secret means "omitted", not "empty response".
    expect(body.id).toBe(user.id)
    expect(body.isFeatured).toBe(true)

    for (const column of SECRET_COLUMNS) {
      expect(body[column], `${column} must never be returned`).toBeUndefined()
    }

    // Belt and braces: the literal secret values must not appear anywhere in the
    // payload, however it happens to be shaped.
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('424242')
    expect(raw).not.toContain(`e2e-reset-token-${stamp}`)
    expect(raw).not.toContain('$2a$10$')
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } })
  }
})
