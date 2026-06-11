import { expect, type Page } from '@playwright/test'

import {
  createPaymentIntent,
  type ShippingAddress,
} from '@/components/checkout/PrintCheckout/createPaymentIntent'
import type { StashedPayment } from '@/components/checkout/PrintPayment/types'
import { buildInitialConfig } from '@/lib/print-providers/configHelpers'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { summarizeConfig } from '@/lib/print-providers/specs'
import type { PrintRestrictions } from '@/lib/print-providers/types'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

import { fixtures } from './fixtures'

/**
 * Stripe-focused helpers that test the *payment* surface in isolation —
 * deliberately bypassing the wizard. The wizard mounts a React-Three-
 * Fiber <Canvas>; under headless Chromium that renders on the CPU
 * (SwiftShader) and pegs a core. The checkout/payment pages render no
 * WebGL, so deep-linking straight to the payment step keeps these specs
 * cheap while still exercising the real Stripe PaymentElement + the
 * server-authoritative createPaymentIntent action.
 *
 * Strategy:
 *   1. Build a valid default print config from the catalog (Node-side,
 *      no browser) — exactly what the wizard would have produced.
 *   2. Call the real `createPaymentIntent` server action to open a
 *      test-mode PaymentIntent (manual capture).
 *   3. Seed `sessionStorage['print-payment:<slug>']` — the stash the
 *      checkout step normally writes — then load /print/payment directly.
 *
 * Requires Stripe test-mode keys (already in .env.local). Does NOT
 * require the local `stripe listen` webhook: the PaymentIntent's state
 * is asserted directly via the Stripe API, so webhook-driven order-row
 * creation is intentionally out of scope here.
 */

export const TEST_CARDS = {
  // Always authorizes, no 3DS challenge.
  success: { number: '4242 4242 4242 4242', expiry: '12 / 34', cvc: '123', zip: '28001' },
  // Generic decline at confirmation time.
  declined: { number: '4000 0000 0000 0002', expiry: '12 / 34', cvc: '123', zip: '28001' },
} as const

export type TestCard = (typeof TEST_CARDS)[keyof typeof TEST_CARDS]

const COUNTRY_CODE = 'BE'

// Monotonic per-process counter. Combined with the wall clock it makes
// every fixtureAddress() call unique, so the idempotency key in
// createPaymentIntent differs across runs — otherwise a later run would
// reuse (and fail on) a PaymentIntent a previous run had canceled.
let addressSeq = 0

/**
 * A fixture shipping address. `fullName` carries the `tag` plus a unique
 * token, so each call produces a distinct idempotency key in
 * createPaymentIntent — both across specs and across runs (a canceled PI
 * from a prior run must not be reused). Callers that need two *identical*
 * keys (the idempotency test) build the address once and reuse it. Pass
 * `overrides` to deliberately make it invalid (bad country/email) for
 * negative-path tests.
 */
export function fixtureAddress(
  tag: string,
  overrides: Partial<ShippingAddress> = {},
): ShippingAddress {
  const unique = `${Date.now().toString(36)}-${addressSeq++}`
  return {
    fullName: `E2E Stripe ${tag} ${unique}`,
    email: 'e2e+stripe@example.com',
    phone: '612345678',
    countryCode: COUNTRY_CODE,
    address1: '123 Rue de la Loi',
    address2: '',
    city: 'Brussels',
    stateOrRegion: '',
    postalCode: '1000',
    ...overrides,
  }
}

export interface FixtureConfig {
  slug: string
  catalog: Awaited<ReturnType<typeof loadProviderCatalog>>
  config: ReturnType<typeof buildInitialConfig>
  specs: ReturnType<typeof summarizeConfig>
  restrictions: PrintRestrictions | null
  artistPriceCents: number
}

/**
 * Build the default print config for the fixture artwork — exactly what
 * the wizard would produce on first paint — without touching Stripe or a
 * browser. Throws loudly if the fixture has drifted (not found / not
 * print-enabled) so the failure is actionable.
 */
export async function buildFixtureConfig(
  slug: string = fixtures.artworkSlug,
): Promise<FixtureConfig> {
  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: {
      originalWidth: true,
      originalHeight: true,
      printOptions: true,
      printEnabled: true,
      printPriceCents: true,
    },
  })
  if (!artwork) {
    throw new Error(`Fixture artwork "${slug}" not found — check fixtures.ts / dev DB`)
  }
  if (!artwork.printEnabled || !artwork.printPriceCents) {
    throw new Error(`Fixture artwork "${slug}" is not print-enabled/priced — can't test payment`)
  }

  const widthPx = artwork.originalWidth ?? 1000
  const heightPx = artwork.originalHeight ?? 1000
  const aspectRatio = widthPx / heightPx
  const restrictions = (artwork.printOptions as PrintRestrictions | null) ?? null

  const catalog = await loadProviderCatalog('printspace', {
    imageWidthPx: widthPx,
    imageHeightPx: heightPx,
  })
  const config = buildInitialConfig(catalog, aspectRatio, restrictions)
  const specs = summarizeConfig(catalog, config)

  return { slug, catalog, config, specs, restrictions, artistPriceCents: artwork.printPriceCents }
}

export interface FixturePayment {
  slug: string
  paymentIntentId: string
  stash: StashedPayment
}

/**
 * Build a default-config PaymentIntent for the fixture artwork (creates a
 * real test-mode PI) and assemble the sessionStorage stash the payment
 * page consumes.
 */
export async function buildFixturePayment(
  tag: string,
  fixtureSlug: string = fixtures.artworkSlug,
): Promise<FixturePayment> {
  const { slug, config, specs } = await buildFixtureConfig(fixtureSlug)
  const address = fixtureAddress(tag)

  const res = await createPaymentIntent({
    artworkSlug: slug,
    providerId: 'printspace',
    config,
    address,
  })
  if (!res.ok) {
    throw new Error(`createPaymentIntent failed for fixture "${slug}": ${res.error}`)
  }

  const stash: StashedPayment = {
    clientSecret: res.clientSecret,
    paymentIntentId: res.paymentIntentId,
    totals: res.totals,
    address,
    providerId: 'printspace',
    config,
    specs,
    country: COUNTRY_CODE,
  }

  return { slug, paymentIntentId: res.paymentIntentId, stash }
}

/**
 * Seed the payment page's sessionStorage stash BEFORE navigation, so the
 * client hydrates against it instead of bouncing back to checkout.
 */
export async function seedPaymentSession(
  page: Page,
  slug: string,
  stash: StashedPayment,
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.sessionStorage.setItem(key, value)
    },
    [`print-payment:${slug}`, JSON.stringify(stash)] as [string, string],
  )
}

/** Open the payment page directly with the seeded session. */
export async function gotoPayment(page: Page, slug: string): Promise<void> {
  const res = await page.goto(`/artworks/${slug}/print/payment?country=${COUNTRY_CODE}`)
  expect(res?.status(), 'payment page should respond 2xx').toBeLessThan(400)
}

/**
 * Fill the Stripe PaymentElement (inside its iframe) with the given card
 * and click Pay.
 */
export async function fillCardAndPay(page: Page, card: TestCard): Promise<void> {
  const frame = page.frameLocator('iframe[title*="Secure payment input frame"]').first()

  // With automatic_payment_methods Stripe may show method tabs; pick Card.
  const cardTab = frame.getByRole('tab', { name: /^card$/i })
  if (await cardTab.count()) {
    await cardTab.first().click()
  }

  const cardNumber = frame.getByLabel(/card number/i)
  await expect(cardNumber, 'card number field should render').toBeVisible({ timeout: 30_000 })
  await cardNumber.fill(card.number)
  await frame.getByRole('textbox', { name: /expir/i }).fill(card.expiry)
  await frame.getByRole('textbox', { name: /security code|cvc/i }).fill(card.cvc)

  const zip = frame.getByRole('textbox', { name: /zip|postal/i })
  if (await zip.count()) {
    await zip.first().fill(card.zip)
  }

  const payCta = page.getByRole('button', { name: /^pay\s+€/i })
  await expect(payCta, 'pay CTA should be visible').toBeVisible({ timeout: 15_000 })
  await payCta.click()
}

/** Retrieve a PaymentIntent's current status straight from Stripe. */
export async function getPaymentIntentStatus(paymentIntentId: string): Promise<string> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  return pi.status
}

/** Best-effort cleanup: release the auth so we don't leave dangling holds. */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<void> {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
  } catch (err) {
    console.warn(
      `[e2e stripe cleanup] cancel ${paymentIntentId} failed:`,
      err instanceof Error ? err.message : err,
    )
  }
}
