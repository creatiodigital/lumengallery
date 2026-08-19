import fs from 'node:fs'
import path from 'node:path'

import { stripe } from '@/lib/stripe/client'

/**
 * Keep the e2e suite's Stripe traffic to itself.
 *
 * The suite authorises real test-mode PaymentIntents. Any webhook endpoint
 * registered in the sandbox receives those events — and our staging endpoint
 * writes to the SAME database the tests assert against, so staging silently
 * becomes a second writer and races the run. It shows up as
 * `order-reconcile` failing with an orderItemId where the test demands null.
 *
 * So: disable every remote endpoint for the duration of the run, restore them
 * afterwards. Local `stripe listen` forwarding is untouched — it registers no
 * endpoint.
 *
 * CRASH SAFETY. globalTeardown does not run if the process is killed (a CI
 * cancel, a Ctrl-C, a command timeout — which is exactly how this bit us the
 * first time). We therefore record what we disabled in a state file and
 * restore from it at the START of the next run too, so a killed suite can
 * never leave Eduardo's staging webhook quietly switched off.
 */

const STATE_FILE = path.join(__dirname, '.auth', '.disabled-webhooks.json')

function readState(): string[] {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function writeState(ids: string[]): void {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    if (ids.length === 0) fs.rmSync(STATE_FILE, { force: true })
    else fs.writeFileSync(STATE_FILE, JSON.stringify(ids, null, 2))
  } catch (err) {
    console.warn('[e2e webhooks] could not persist state:', err instanceof Error ? err.message : err)
  }
}

/** Hard refusal: this must never touch a live account's endpoints. */
function assertTestMode(): void {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (key.startsWith('sk_live') || key.startsWith('rk_live')) {
    throw new Error('[e2e webhooks] refusing to modify webhooks on a LIVE Stripe key.')
  }
}

/** Re-enable anything a previous run left disabled. Safe to call any time. */
export async function restoreWebhookEndpoints(): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) return
  const ids = readState()
  if (ids.length === 0) return
  assertTestMode()

  const restored: string[] = []
  for (const id of ids) {
    try {
      await stripe.webhookEndpoints.update(id, { disabled: false })
      restored.push(id)
    } catch (err) {
      // A deleted endpoint is not an error worth failing a run over.
      console.warn(
        `[e2e webhooks] could not re-enable ${id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
  writeState([])
  if (restored.length > 0) console.log(`[e2e webhooks] re-enabled ${restored.join(', ')}`)
}

/**
 * Disable every enabled endpoint and remember which ones, so the suite is the
 * only thing reacting to its own events.
 */
export async function disableWebhookEndpoints(): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) return
  assertTestMode()

  // Anything stranded by a killed run goes back on first, so the state file
  // never accumulates and we always start from a known-good position.
  await restoreWebhookEndpoints()

  let endpoints
  try {
    endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  } catch (err) {
    console.warn(
      '[e2e webhooks] could not list endpoints — continuing:',
      err instanceof Error ? err.message : err,
    )
    return
  }

  const toDisable = endpoints.data.filter((e) => e.status === 'enabled')
  if (toDisable.length === 0) return

  const disabled: string[] = []
  for (const e of toDisable) {
    try {
      await stripe.webhookEndpoints.update(e.id, { disabled: true })
      disabled.push(e.id)
    } catch (err) {
      console.warn(
        `[e2e webhooks] could not disable ${e.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
  // Persist BEFORE the run starts so a kill mid-suite is recoverable.
  writeState(disabled)
  if (disabled.length > 0) {
    console.log(
      `[e2e webhooks] disabled for this run: ${toDisable
        .filter((e) => disabled.includes(e.id))
        .map((e) => e.url)
        .join(', ')}`,
    )
  }
}
