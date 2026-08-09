import { expect, type APIRequestContext } from '@playwright/test'

import {
  createCartPaymentIntent,
  type CartCheckoutItem,
} from '@/components/checkout/CartCheckout/createCartPaymentIntent'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'
import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
import { createPrintOrderFromCart } from '@/lib/orders/createPrintOrderFromCart'
import prisma from '@/lib/prisma'
import type { WizardConfig } from '@/lib/print-providers/types'
import { stripe } from '@/lib/stripe/client'

import {
  setupLimitedFixture,
  teardownLimitedFixture,
  setupOpenFixture,
  teardownOpenFixture,
} from './edition-helpers'
import { buildFixtureConfig, cancelPaymentIntent, fixtureAddress } from './stripe-helpers'
import { deletePrintOrderById } from './cleanup-helpers'

type LimitedFixture = Awaited<ReturnType<typeof setupLimitedFixture>>
type OpenFixture = Awaited<ReturnType<typeof setupOpenFixture>>

// Per-call unique cart-line id. A line just needs a stable id within its cart.
let lineSeq = 0
const nextLineId = () => `e2e-line-${(lineSeq += 1)}`

// A limited cart line. config is ignored server-side (the variant's config is
// pinned), and an empty editionNumberIds makes the server reserve the number
// fresh — it claims the lowest available.
const limitedLine = (fixture: LimitedFixture): CartCheckoutItem => ({
  lineId: nextLineId(),
  artworkSlug: fixture.slug,
  providerId: 'printspace',
  config: { values: {} },
  variantId: fixture.variantId,
  editionType: 'limited',
  quantity: 1,
  editionNumberIds: [],
})

// An open cart line. Open editions reserve no number; the config IS priced, so
// it must be a valid (catalog-shippable) config — use buildFixtureConfig.
const openLine = (slug: string, config: WizardConfig): CartCheckoutItem => ({
  lineId: nextLineId(),
  artworkSlug: slug,
  providerId: 'printspace',
  config,
  editionType: 'open',
  quantity: 1,
})

/**
 * The shared money path: validate + reserve + open ONE manual-capture cart PI,
 * authorize it headlessly via the Stripe API (no wizard/WebGL/PaymentElement),
 * then build the order the way the webhook does (createPrintOrderFromCart).
 * Returns the ids + the server-authoritative total.
 */
async function placeCartOrder(
  items: CartCheckoutItem[],
  address: ShippingAddress,
): Promise<{ paymentIntentId: string; orderId: string; totalCents: number }> {
  // HARD STOP — triggering real email from a test is absolutely forbidden.
  // This path builds the order IN THIS PROCESS (not via the dev server), so it
  // calls the buyer/admin email senders directly; they only short-circuit when
  // SKIP_EMAILS=true is set in THIS process. playwright.config sets it on the
  // test runner by default. If it isn't set, refuse to proceed rather than send.
  // E2E_SEND_EMAILS=true is the explicit opt-in for the rare template-verify run.
  if (process.env.SKIP_EMAILS !== 'true' && process.env.E2E_SEND_EMAILS !== 'true') {
    throw new Error(
      'Refusing to place an order: SKIP_EMAILS is not "true" in this process, so the ' +
        'in-process money-path (createPrintOrderFromCart) would send REAL buyer + admin ' +
        'emails. The Playwright config sets SKIP_EMAILS on the test runner by default — if ' +
        'you hit this, that injection regressed. Use E2E_SEND_EMAILS=true only to verify templates.',
    )
  }

  const intent = await createCartPaymentIntent({ items, address })
  expect(
    intent.ok,
    intent.ok ? '' : `createCartPaymentIntent failed: ${!intent.ok && intent.error}`,
  ).toBe(true)
  if (!intent.ok) throw new Error('unreachable')
  const paymentIntentId = intent.paymentIntentId

  await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://example.com/e2e-return',
  })
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  expect(pi.status, 'authorized cart PI should be held for capture').toBe('requires_capture')

  const created = await createPrintOrderFromCart(pi)
  expect(
    created.ok,
    created.ok ? '' : `createPrintOrderFromCart failed: ${!created.ok && created.error}`,
  ).toBe(true)
  if (!created.ok) throw new Error('unreachable')

  return { paymentIntentId, orderId: created.orderId, totalCents: intent.totals.totalCents }
}

const assignedNumber = async (paymentIntentId: string): Promise<number> => {
  const bound = await prisma.editionNumber.findFirst({
    where: { paymentIntentId },
    select: { number: true },
  })
  return bound?.number ?? -1
}

export type BoughtCopy = {
  paymentIntentId: string
  orderId: string
  /** Series number assigned (the lowest available at purchase time). */
  number: number
  totalCents: number
  /** The address handed to checkout — mutated in place by the server's
   *  sanitizer, so after the call it equals what was stored. */
  address: ShippingAddress
}

export type BoughtLimitedOrder = BoughtCopy & {
  fixture: LimitedFixture
  editionSize: number
}

/**
 * Buy ONE copy against an ALREADY-CREATED limited fixture, so several buyers can
 * hit the SAME variant in one test. Pass a distinct `email` to model distinct
 * buyers (the edition number is assigned lowest-available regardless of buyer).
 */
export async function buyExistingLimited(
  fixture: LimitedFixture,
  opts: { tag?: string; email?: string } = {},
): Promise<BoughtCopy> {
  const tag = opts.tag ?? 'buy-existing-limited'
  const address = fixtureAddress(tag, opts.email ? { email: opts.email } : {})
  const { paymentIntentId, orderId, totalCents } = await placeCartOrder(
    [limitedLine(fixture)],
    address,
  )
  return {
    paymentIntentId,
    orderId,
    number: await assignedNumber(paymentIntentId),
    totalCents,
    address,
  }
}

/**
 * Buy ONE limited print against a FRESH throwaway fixture, fully headless. The
 * order is a cart order (PrintOrder + one PrintOrderItem, number bound via
 * orderItemId). The building block for the single-line lifecycle tests.
 */
export async function buyOneLimited(
  opts: { editionSize?: number; tag?: string } = {},
): Promise<BoughtLimitedOrder> {
  const editionSize = opts.editionSize ?? 30
  const fixture = await setupLimitedFixture(editionSize)
  const copy = await buyExistingLimited(fixture, { tag: opts.tag ?? 'buy-one-limited' })
  return { fixture, editionSize, ...copy }
}

/** Teardown for a single-limited bought order, safe in finally{}. */
export async function teardownBoughtOrder(bought: BoughtLimitedOrder | null): Promise<void> {
  if (!bought) return
  if (process.env.E2E_KEEP_DATA === '1') return // keep for manual inspection
  await releaseEditionNumberForPaymentIntent(bought.paymentIntentId, { allowSold: true })
  await cancelPaymentIntent(bought.paymentIntentId)
  await deletePrintOrderById(bought.orderId)
  await teardownLimitedFixture(bought.fixture)
}

export type BoughtMixedOrder = {
  limited: LimitedFixture
  open: OpenFixture
  paymentIntentId: string
  orderId: string
  /** The limited line's series number (1 on a fresh fixture). The open line
   *  carries no number. */
  number: number
  editionSize: number
  totalCents: number
  address: ShippingAddress
}

/**
 * Buy ONE limited + ONE open print in a SINGLE cart (one order, one PI). Only
 * the limited line reserves a number; the open line carries none. Throwaway
 * fixtures (not the shared seeded artworks) so the edition starts fresh —
 * guaranteeing 1/30 — and self-deletes, leaving zero stale data.
 */
export async function buyLimitedPlusOpen(
  opts: { editionSize?: number; tag?: string } = {},
): Promise<BoughtMixedOrder> {
  const editionSize = opts.editionSize ?? 30
  const tag = opts.tag ?? 'buy-limited-plus-open'

  const limited = await setupLimitedFixture(editionSize)
  const open = await setupOpenFixture()
  const address = fixtureAddress(tag)

  // The open line is priced from its config, so it must be a valid shippable
  // config; the limited line's config is pinned server-side.
  const openConfig = (await buildFixtureConfig(open.slug)).config

  const { paymentIntentId, orderId, totalCents } = await placeCartOrder(
    [limitedLine(limited), openLine(open.slug, openConfig)],
    address,
  )

  return {
    limited,
    open,
    paymentIntentId,
    orderId,
    number: await assignedNumber(paymentIntentId),
    editionSize,
    totalCents,
    address,
  }
}

/** Teardown for a mixed bought order, safe in finally{}: releases the number,
 *  voids the hold, deletes the order, drops BOTH throwaway fixtures. Each step
 *  is idempotent, so it's safe even if the test already deleted the order. */
export async function teardownBoughtMixed(bought: BoughtMixedOrder | null): Promise<void> {
  if (!bought) return
  if (process.env.E2E_KEEP_DATA === '1') return // keep for manual inspection
  await releaseEditionNumberForPaymentIntent(bought.paymentIntentId, { allowSold: true })
  await cancelPaymentIntent(bought.paymentIntentId)
  await deletePrintOrderById(bought.orderId)
  await teardownLimitedFixture(bought.limited)
  await teardownOpenFixture(bought.open)
}

/**
 * Authorize a limited cart PI but DO NOT create the order — leaving the order
 * to be created by the REAL `/api/webhooks/stripe` route (see
 * order-webhook.spec.ts). Mirrors placeCartOrder's money path up to the hold,
 * then stops: createCartPaymentIntent (stages the PendingCart row the webhook
 * consumes) + Stripe auth. No in-process builder call, so no email is sent from
 * the test runner; the webhook-created order's emails fire inside the dev server
 * where SKIP_EMAILS is set ([[feedback_no_emails_in_e2e]]).
 */
export async function authorizeLimitedCartPI(
  fixture: LimitedFixture,
  opts: { tag?: string; email?: string } = {},
): Promise<{ paymentIntentId: string; totalCents: number; address: ShippingAddress }> {
  const tag = opts.tag ?? 'authorize-limited-cart'
  const address = fixtureAddress(tag, opts.email ? { email: opts.email } : {})
  const intent = await createCartPaymentIntent({ items: [limitedLine(fixture)], address })
  expect(
    intent.ok,
    intent.ok ? '' : `createCartPaymentIntent failed: ${!intent.ok && intent.error}`,
  ).toBe(true)
  if (!intent.ok) throw new Error('unreachable')

  await stripe.paymentIntents.confirm(intent.paymentIntentId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://example.com/e2e-return',
  })
  const pi = await stripe.paymentIntents.retrieve(intent.paymentIntentId)
  expect(pi.status, 'authorized cart PI should be held for capture').toBe('requires_capture')

  return {
    paymentIntentId: intent.paymentIntentId,
    totalCents: intent.totals.totalCents,
    address,
  }
}

/**
 * Hit the REAL reconcile-orders cron route as Vercel Cron would: a GET with
 * `Authorization: Bearer <CRON_SECRET>`. `minAgeMinutes` overrides the route's
 * default 30-min min-age so a freshly-created test PI isn't skipped as "too young"
 * (the override is auth-gated; production cron sends no param). Pass an explicit
 * `secret` (incl. '') to exercise the auth gate. Returns status + parsed JSON.
 *
 * CRON_SECRET is pinned + injected into the dev server and this runner by
 * playwright.config — see the cronEnv block there.
 */
export async function hitReconcileCron(
  request: APIRequestContext,
  opts: { minAgeMinutes?: number; secret?: string | null } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = opts.secret === undefined ? process.env.CRON_SECRET : opts.secret
  const qs = opts.minAgeMinutes != null ? `?minAgeMinutes=${opts.minAgeMinutes}` : ''
  const headers: Record<string, string> = {}
  if (secret) headers.authorization = `Bearer ${secret}`
  const res = await request.get(`/api/cron/reconcile-orders${qs}`, { headers })
  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    // non-JSON body (shouldn't happen) — leave body empty
  }
  return { status: res.status(), body }
}

/**
 * Backdate an edition number's `reservedAt` past the reconcile min-age cutoff so
 * Phase B (orphan-reservation release) considers it. Mirrors the real-world case
 * where a reservation has been stuck for longer than the grace window.
 */
export async function backdateReservation(paymentIntentId: string, minutesAgo = 45): Promise<void> {
  await prisma.editionNumber.updateMany({
    where: { paymentIntentId },
    data: { reservedAt: new Date(Date.now() - minutesAgo * 60 * 1000) },
  })
}

/**
 * Deliver a Stripe event to the REAL webhook route exactly as Stripe would over
 * the wire: the body is the event JSON, signed with STRIPE_WEBHOOK_SECRET via
 * the Stripe SDK's test-header helper so the route's `constructEvent` signature
 * check passes. The PI is re-fetched from Stripe so `data.object` is the real
 * object (carrying `metadata.kind` etc.). Returns the route's HTTP status.
 *
 * Pass the pre-stringified payload to `request.post` as `data` so Playwright
 * sends it byte-for-byte — re-serializing an object would change the bytes and
 * break the signature.
 */
export async function deliverSignedStripeEvent(
  request: APIRequestContext,
  opts: { type: string; paymentIntentId: string },
): Promise<number> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing in test env — check .env.local')

  const pi = await stripe.paymentIntents.retrieve(opts.paymentIntentId)
  const event = {
    id: `evt_e2e_${opts.paymentIntentId}`,
    object: 'event',
    type: opts.type,
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    data: { object: pi },
  }
  const payload = JSON.stringify(event)
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })

  const res = await request.post('/api/webhooks/stripe', {
    headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
    data: payload,
  })
  return res.status()
}
