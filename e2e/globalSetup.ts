import path from 'node:path'
import fs from 'node:fs'

import { chromium, type FullConfig } from '@playwright/test'

import { getAdminCredentials, getArtistCredentials, signInThroughUi } from './auth-helpers'
import { disableWebhookEndpoints } from './webhook-guard'

/**
 * Logs in as admin and as artist once, saving each session's
 * cookies to a JSON file under e2e/.auth/. Specs that need to be
 * authenticated reuse those via:
 *
 *   test.use({ storageState: 'e2e/.auth/admin.json' })
 *
 * Why bother: the send-login-code endpoint rate-limits at 5/min per
 * IP. Without this setup, every auth-using test would re-issue a
 * login code and we'd burn through the bucket fast. Doing one login
 * per role here cuts the fresh logins per run down to just the two
 * specs (admin-login, artist-login) that explicitly test the login UI.
 *
 * The folder is gitignored (.gitignore: /e2e/.auth/).
 */
async function globalSetup(_config: FullConfig) {
  // Auth-free runs (e.g. the prod-build CMS/render smoke) set this to skip
  // the admin/artist UI login. In a production build NODE_ENV is
  // 'production', which bypasses SKIP_LOGIN_OTP and makes the localhost UI
  // login unreliable — and those runs touch no authed specs anyway.
  if (process.env.E2E_SKIP_AUTH === '1') {
    console.log('[globalSetup] E2E_SKIP_AUTH=1 — skipping login (no authed specs in this run)')
    return
  }

  // Stop staging (or any other registered endpoint) reacting to the events this
  // suite fires — it shares this database and would race the tests. Restored in
  // globalTeardown, and defensively at the start of the next run.
  await disableWebhookEndpoints()

  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'
  const browser = await chromium.launch()

  for (const { credentials, file } of [
    { credentials: getAdminCredentials(), file: 'admin.json' },
    { credentials: getArtistCredentials(), file: 'artist.json' },
  ]) {
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    await signInThroughUi(page, credentials)
    await context.storageState({ path: path.join(authDir, file) })
    await context.close()
  }

  await browser.close()
}

export default globalSetup
