import path from 'node:path'

import { config as loadDotenv } from 'dotenv'

import { defineConfig, devices } from '@playwright/test'

// Load env files into process.env BEFORE any spec / helper imports
// run. Helpers transitively import Prisma, which throws if
// POSTGRES_PRISMA_URL is missing — so this has to happen first.
//   .env.local       — DB / Stripe / app config (shared with `pnpm dev`)
//   .env.test.local  — admin/artist credentials used by globalSetup +
//                      the auth specs. See .env.test.local.example.
const ROOT = __dirname
loadDotenv({ path: path.join(ROOT, '.env.local') })
loadDotenv({ path: path.join(ROOT, '.env.test.local'), override: true })

/**
 * Playwright configuration — local-only e2e tests.
 *
 * - Tests live in `./e2e`.
 * - Base URL defaults to `http://localhost:3001` — the same port as
 *   `pnpm dev`. Override with `PLAYWRIGHT_BASE_URL=http://localhost:4000 pnpm test:e2e`.
 * - `reuseExistingServer: false` — Playwright always spawns its own
 *   `next dev -p 3001` for the run. We need this so the email-skip
 *   env vars below actually land on the dev server's process (an
 *   already-running server has its own frozen env). Practical
 *   consequence: stop `pnpm dev` before running e2e, otherwise the
 *   spawn fails with "port 3001 already in use".
 * - We keep e2e on 3001 (instead of a separate port) so the existing
 *   Stripe CLI forwarder (`stripe listen --forward-to localhost:3001/...`)
 *   reaches the test server without any reconfiguration. The buyer +
 *   admin-lifecycle specs need that webhook to land for the PrintOrder
 *   row to get created.
 * - No CI-specific config: these tests are intentionally not wired
 *   into the build pipeline. Run them by hand with `pnpm test:e2e`.
 *
 * Email handling:
 *   - `pnpm test:e2e` (default, daily/pre-push): SKIP_EMAILS,
 *     SKIP_LOGIN_EMAIL, SKIP_LOGIN_OTP are all injected into the dev
 *     server, so no real Resend traffic leaves the suite.
 *   - `pnpm test:e2e:send-emails` (rare, manual verification): same
 *     suite but emails actually go out. Use only when verifying
 *     templates or end-to-end Resend delivery — burns the quota fast.
 *
 * Most specs are read-only by contract — they hit a shared dev /
 * staging DB and observe state without mutating it. The exceptions
 * are full-flow specs that exercise the buyer + admin pipelines
 * end-to-end (buyer-checkout, admin-order-lifecycle): those create
 * a real PrintOrder + Stripe test-mode PaymentIntent and clean up
 * after themselves in a `finally` block via cleanup-helpers.ts. New
 * specs should default to read-only; only opt in to writes when the
 * test target is the persistence pipeline itself.
 *
 * Other pre-requisites for the write specs:
 *   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY pointing
 *     at Stripe test-mode keys.
 *   - Local Stripe CLI webhook listener forwarding to /api/webhooks/stripe
 *     so the order row actually gets created.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

// Default = suppress all email sends. Opt in to real sends with
// `pnpm test:e2e-no-skips`, which sets E2E_SEND_EMAILS=true.
const sendEmails = process.env.E2E_SEND_EMAILS === 'true'
const emailSkipEnv: Record<string, string> = sendEmails
  ? {}
  : {
      SKIP_EMAILS: 'true',
      SKIP_LOGIN_EMAIL: 'true',
      SKIP_LOGIN_OTP: 'true',
    }

// The skip flags above are injected into the spawned dev server (webServer.env
// below) — which protects every email sent FROM the server (browser checkout,
// Stripe webhooks). But some specs build orders IN-PROCESS: e2e/order-helpers.ts
// calls createPrintOrderFromCart directly in the test-runner process, and its
// buyer/admin email senders read SKIP_EMAILS from THIS process's env — which
// webServer.env never touches. So apply the same skip to the runner itself.
// This runs at config-load time in every worker (exactly like loadDotenv above),
// so the in-process money-path short-circuits its sends instead of emailing for
// real. No-op when E2E_SEND_EMAILS=true (emailSkipEnv is empty), so the opt-in
// send-emails run is unaffected.
Object.assign(process.env, emailSkipEnv)

// The reconcile-orders cron route 401s without `Authorization: Bearer
// <CRON_SECRET>` and 500s if CRON_SECRET is unset. It isn't in .env.local (it's a
// Vercel-only prod var), so pin a fixed dev value here and inject it into BOTH the
// dev server (webServer.env, so the route reads it) AND the runner's process.env
// (so order-reconcile.spec.ts can send the matching Bearer header). Honors a real
// CRON_SECRET if one is already present.
const CRON_SECRET = process.env.CRON_SECRET ?? 'e2e-reconcile-cron-secret'
process.env.CRON_SECRET = CRON_SECRET
const cronEnv: Record<string, string> = { CRON_SECRET }

// Opt-in: run the suite against a real production build (`next build &&
// next start`) instead of the default `next dev`. Use sparingly — for
// big refactors, `'use client'` ↔ server-component conversions, dep
// upgrades, or anything that changes module loading. The dev server's
// loader is more forgiving than Vercel's serverless runtime; this mode
// catches the class of regression that 500'd prod on AR-112. Each run
// adds ~30–60s for the build.
//
// Caveats when E2E_PROD_BUILD=true:
//   - NODE_ENV becomes "production", so the SKIP_EMAILS / SKIP_LOGIN_*
//     guards (which check `NODE_ENV !== 'production'`) are bypassed:
//     two real login-code emails fire to the test creds on each run.
//   - AUTH_TRUST_HOST=true is required to let NextAuth issue sessions
//     on localhost in prod mode (UntrustedHost otherwise).
const prodBuild = process.env.E2E_PROD_BUILD === 'true'

// Optional: pass a GA4 Measurement ID through to the test server so the
// cookie-consent spec can exercise the full Consent Mode path. Unset by
// default — the spec's GA assertions skip when GA isn't loaded.
const gaEnv: Record<string, string> = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  ? { NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID }
  : {}

export default defineConfig({
  testDir: './e2e',
  // globalSetup runs once before any spec. It logs in as admin and
  // artist via the UI and saves cookies to e2e/.auth/{admin,artist}.json
  // so authenticated specs don't each re-trigger send-login-code (which
  // rate-limits at 5/min per IP).
  globalSetup: './e2e/globalSetup.ts',
  // Safety-net sweep after the whole run: removes any e2e-created fixture/order,
  // even ones a TIMED-OUT test left behind (per-spec finally{} doesn't run on
  // timeout). Surgical — only e2e-tagged data; never a blanket wipe. See the file.
  globalTeardown: './e2e/globalTeardown.ts',
  // Sequential by default — most flows touch shared dev DB state, and
  // we'd rather not chase flake from parallel writes until we have a
  // reason to opt back in per-spec.
  fullyParallel: false,
  workers: 1,
  forbidOnly: false,
  // One auto-retry. The login specs (admin-login, artist-login) hit
  // /api/auth/send-login-code, which rate-limits at 5/min/IP — re-
  // running the suite within a minute can push us over the cap and
  // flake the very first auth spec. A single retry absorbs that blip
  // without slowing down clean runs.
  retries: 1,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    // Capture on failure only — keeps the run lean while still giving
    // you something useful when something breaks.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: prodBuild ? 'next build && next start -p 3001' : 'next dev -p 3001',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: prodBuild ? 180_000 : 120_000,
    env: prodBuild
      ? { ...emailSkipEnv, ...gaEnv, ...cronEnv, AUTH_TRUST_HOST: 'true' }
      : { ...emailSkipEnv, ...gaEnv, ...cronEnv },
  },
})
