import { test, expect } from '@playwright/test'

import { createPaymentIntent } from '@/components/checkout/PrintCheckout/createPaymentIntent'
import { TPS_PAPERS } from '@/lib/print-providers/printspace/data'

import { restoreArtworkPrintOptions, setArtworkPrintOptions } from './cleanup-helpers'
import { setupOpenFixture, teardownOpenFixture, type OpenFixture } from './edition-helpers'
import { buildFixtureConfig, cancelPaymentIntent, fixtureAddress } from './stripe-helpers'

/**
 * createPaymentIntent contract — the server-authoritative money path.
 *
 * These specs call the server action DIRECTLY (no browser, no wizard, no
 * WebGL): they build the fixture's default config, then assert the
 * action's validation + pricing behavior. This is the cheapest way to
 * guard the security-critical surface (price tampering, restriction
 * re-check, unsupported destinations, idempotency) — see the security
 * audit invariants.
 *
 * The happy-path and idempotency cases open real test-mode
 * PaymentIntents (cleaned up via cancel); the rejection cases
 * short-circuit before Stripe is ever called. All need the Stripe
 * test-mode keys in .env.local (present).
 */

// 45% gallery markup — mirrors GALLERY_MARKUP_RATE in createPaymentIntent.ts.
const GALLERY_MARKUP_RATE = 0.45

test.describe('createPaymentIntent contract', () => {
  // Self-seeded throwaway OPEN artwork — keeps these specs independent of
  // the shared fixture artwork's editionType (which drifts to 'limited'
  // during limited-edition QA). Created once per worker, deleted after.
  let open: OpenFixture
  test.beforeAll(async () => {
    open = await setupOpenFixture()
  })
  test.afterAll(async () => {
    await teardownOpenFixture(open)
  })

  test('valid config returns a clientSecret with a correct price split', async () => {
    const { slug, config, artistPriceCents } = await buildFixtureConfig(open.slug)

    const res = await createPaymentIntent({
      artworkSlug: slug,
      providerId: 'printspace',
      config,
      address: fixtureAddress('contract-happy'),
    })

    expect(res.ok, res.ok ? '' : `createPaymentIntent rejected a valid config: ${res.error}`).toBe(
      true,
    )
    if (!res.ok) return // type-narrow

    try {
      expect(res.clientSecret, 'a Stripe client secret should be returned').toContain('_secret_')
      expect(res.paymentIntentId).toMatch(/^pi_/)

      const t = res.totals
      expect(t.currency).toBe('eur')
      // Artist keeps their set price; gallery markup is derived from it.
      expect(t.artistCents).toBe(artistPriceCents)
      expect(t.galleryCents).toBe(Math.round(artistPriceCents * GALLERY_MARKUP_RATE))
      expect(t.productionCents).toBeGreaterThanOrEqual(0)
      expect(t.shippingCents).toBeGreaterThanOrEqual(0)
      expect(t.customerVatCents).toBeGreaterThanOrEqual(0)
      // The grand total must equal the sum of every line component.
      expect(t.totalCents).toBe(
        t.productionCents + t.shippingCents + t.artistCents + t.galleryCents + t.customerVatCents,
      )
      expect(t.totalCents).toBeGreaterThan(0)
    } finally {
      await cancelPaymentIntent(res.paymentIntentId)
    }
  })

  test('identical input is idempotent (returns the same PaymentIntent)', async () => {
    const { slug, config } = await buildFixtureConfig(open.slug)
    const address = fixtureAddress('contract-idem')
    const input = { artworkSlug: slug, providerId: 'printspace' as const, config, address }

    const first = await createPaymentIntent(input)
    const second = await createPaymentIntent(input)

    expect(first.ok && second.ok, 'both calls should succeed').toBe(true)
    if (!first.ok || !second.ok) return

    try {
      expect(
        second.paymentIntentId,
        'same config+address+total must reuse the cached PaymentIntent',
      ).toBe(first.paymentIntentId)
    } finally {
      await cancelPaymentIntent(first.paymentIntentId)
    }
  })

  test('rejects an unsupported destination country', async () => {
    const { slug, config } = await buildFixtureConfig(open.slug)

    const res = await createPaymentIntent({
      artworkSlug: slug,
      providerId: 'printspace',
      config,
      // 'ZZ' is a well-formed but unsupported country code.
      address: fixtureAddress('contract-country', { countryCode: 'ZZ' }),
    })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/ship|country/i)
  })

  test('rejects a config that clashes with a now-vetoed paper', async () => {
    const { slug, config } = await buildFixtureConfig(open.slug)

    // The default config selected some paper; veto exactly that one so
    // the config the buyer "already had" is no longer allowed.
    const selectedPaperId = config.values['paper']
    expect(selectedPaperId, 'default config should select a paper').toBeTruthy()
    const allowedPapers = TPS_PAPERS.filter((p) => p.id !== selectedPaperId).map((p) => p.id)

    const previous = await setArtworkPrintOptions(slug, { allowed: { paper: allowedPapers } })
    try {
      const res = await createPaymentIntent({
        artworkSlug: slug,
        providerId: 'printspace',
        config,
        address: fixtureAddress('contract-clash'),
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/available|different one/i)
    } finally {
      await restoreArtworkPrintOptions(slug, previous)
    }
  })

  test('rejects a tampered config (size out of bounds)', async () => {
    const { slug, config } = await buildFixtureConfig(open.slug)

    const tampered = { ...config, customSize: { widthCm: 9999, heightCm: 9999 } }
    const res = await createPaymentIntent({
      artworkSlug: slug,
      providerId: 'printspace',
      config: tampered,
      address: fixtureAddress('contract-tamper'),
    })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/invalid request/i)
  })

  test('rejects an address with a malformed email', async () => {
    const { slug, config } = await buildFixtureConfig(open.slug)

    const res = await createPaymentIntent({
      artworkSlug: slug,
      providerId: 'printspace',
      config,
      address: fixtureAddress('contract-email', { email: 'not-an-email' }),
    })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/invalid request/i)
  })
})
