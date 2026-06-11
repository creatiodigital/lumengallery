import { test, expect } from '@playwright/test'

import { createPaymentIntent } from '@/components/checkout/PrintCheckout/createPaymentIntent'
import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'
import type { WizardConfig } from '@/lib/print-providers/types'
import { stripe } from '@/lib/stripe/client'

import {
  editionNumberStates,
  setupLimitedFixture,
  teardownLimitedFixture,
  setupOpenFixture,
  teardownOpenFixture,
} from './edition-helpers'
import { buildFixtureConfig, cancelPaymentIntent, fixtureAddress } from './stripe-helpers'

/**
 * Edition-type contract for the createPaymentIntent server action — the
 * money path for the limited-edition refactor. Calls the action directly
 * (no browser, no wizard, no WebGL), asserting the LOGIC results:
 *   - open editions reject a stray variantId
 *   - limited editions reserve a unique number, pin the server config,
 *     enforce stock (sold out), require a variant, and release cleanly
 *
 * No duplicate edition numbers — ever — is the headline invariant.
 *
 * Limited specs use a DEDICATED throwaway artwork (created + deleted per
 * test) so they never touch the shared open fixture other specs read.
 * Needs Stripe test-mode keys (.env.local) + the synced DB schema
 * (LimitedVariant / EditionNumber tables).
 */

// Shape-valid but content-empty client config. The server ignores it for
// limited editions (it pins the variant's config) — passing it proves so.
const MINIMAL_CONFIG: WizardConfig = { values: {} }

test.describe('Edition types — createPaymentIntent', () => {
  test.describe('Open editions', () => {
    test('a supplied variantId is rejected on an open edition', async () => {
      const open = await setupOpenFixture()
      try {
        const { slug, config } = await buildFixtureConfig(open.slug)

        const res = await createPaymentIntent({
          artworkSlug: slug,
          providerId: 'printspace',
          config,
          variantId: 'a-variant-id-that-should-not-be-here',
          address: fixtureAddress('open-variantid'),
        })

        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.error).toMatch(/invalid request/i)
      } finally {
        await teardownOpenFixture(open)
      }
    })
  })

  test.describe('Limited editions', () => {
    test('reserves a number and pins the server config (ignoring client tampering)', async () => {
      const fx = await setupLimitedFixture(5)
      let piId: string | null = null
      try {
        const res = await createPaymentIntent({
          artworkSlug: fx.slug,
          providerId: 'printspace',
          // Deliberately wrong client config — server must IGNORE it and
          // pin the variant's paper + print-only format.
          config: { values: { paper: 'fuji-gloss', format: 'framing' } },
          variantId: fx.variantId,
          address: fixtureAddress('limited-reserve'),
        })
        expect(res.ok, res.ok ? '' : `limited reserve rejected: ${!res.ok && res.error}`).toBe(true)
        if (!res.ok) return
        piId = res.paymentIntentId

        // Exactly one number is reserved, bound to this PI, in range.
        const reserved = (await editionNumberStates(fx.variantId)).filter(
          (s) => s.state === 'reserved',
        )
        expect(reserved).toHaveLength(1)
        expect(reserved[0].paymentIntentId).toBe(piId)
        expect(reserved[0].number).toBeGreaterThanOrEqual(1)
        expect(reserved[0].number).toBeLessThanOrEqual(fx.editionSize)

        // The PI carries the edition metadata + the SERVER-pinned config.
        const pi = await stripe.paymentIntents.retrieve(piId)
        expect(pi.metadata.editionType).toBe('limited')
        expect(pi.metadata.variantId).toBe(fx.variantId)
        const pinned = JSON.parse(pi.metadata.wizardConfig ?? '{}') as WizardConfig
        expect(pinned.values.paper).toBe('hahnemuhle-german-etching')
        expect(pinned.values.format).toBe('print-only')
      } finally {
        if (piId) {
          await releaseEditionNumberForPaymentIntent(piId)
          await cancelPaymentIntent(piId)
        }
        await teardownLimitedFixture(fx)
      }
    })

    test('never assigns a duplicate number to two concurrent buyers', async () => {
      const fx = await setupLimitedFixture(5)
      const pis: string[] = []
      try {
        const [a, b] = await Promise.all([
          createPaymentIntent({
            artworkSlug: fx.slug,
            providerId: 'printspace',
            config: MINIMAL_CONFIG,
            variantId: fx.variantId,
            address: fixtureAddress('limited-dup-a'),
          }),
          createPaymentIntent({
            artworkSlug: fx.slug,
            providerId: 'printspace',
            config: MINIMAL_CONFIG,
            variantId: fx.variantId,
            address: fixtureAddress('limited-dup-b'),
          }),
        ])
        expect(a.ok && b.ok, 'both reservations should succeed').toBe(true)
        if (!a.ok || !b.ok) return
        pis.push(a.paymentIntentId, b.paymentIntentId)

        const reserved = (await editionNumberStates(fx.variantId)).filter(
          (s) => s.state === 'reserved',
        )
        expect(reserved).toHaveLength(2)
        const numbers = reserved.map((r) => r.number)
        expect(new Set(numbers).size, 'the two reservations must be DIFFERENT numbers').toBe(2)
      } finally {
        for (const id of pis) {
          await releaseEditionNumberForPaymentIntent(id)
          await cancelPaymentIntent(id)
        }
        await teardownLimitedFixture(fx)
      }
    })

    test('requires a variantId', async () => {
      const fx = await setupLimitedFixture(5)
      try {
        const res = await createPaymentIntent({
          artworkSlug: fx.slug,
          providerId: 'printspace',
          config: MINIMAL_CONFIG,
          address: fixtureAddress('limited-no-variant'),
        })
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.error).toMatch(/choose a size|variant/i)
      } finally {
        await teardownLimitedFixture(fx)
      }
    })

    test('rejects a purchase once the edition is sold out', async () => {
      const fx = await setupLimitedFixture(1) // a single copy
      let piId: string | null = null
      try {
        const first = await createPaymentIntent({
          artworkSlug: fx.slug,
          providerId: 'printspace',
          config: MINIMAL_CONFIG,
          variantId: fx.variantId,
          address: fixtureAddress('limited-soldout-1'),
        })
        expect(first.ok).toBe(true)
        if (first.ok) piId = first.paymentIntentId

        const second = await createPaymentIntent({
          artworkSlug: fx.slug,
          providerId: 'printspace',
          config: MINIMAL_CONFIG,
          variantId: fx.variantId,
          address: fixtureAddress('limited-soldout-2'),
        })
        expect(second.ok).toBe(false)
        if (!second.ok) expect(second.error).toMatch(/sold out/i)
      } finally {
        if (piId) {
          await releaseEditionNumberForPaymentIntent(piId)
          await cancelPaymentIntent(piId)
        }
        await teardownLimitedFixture(fx)
      }
    })

    test('releasing a reservation returns the number to the pool', async () => {
      const fx = await setupLimitedFixture(3)
      let piId: string | null = null
      try {
        const res = await createPaymentIntent({
          artworkSlug: fx.slug,
          providerId: 'printspace',
          config: MINIMAL_CONFIG,
          variantId: fx.variantId,
          address: fixtureAddress('limited-release'),
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        piId = res.paymentIntentId

        expect(
          (await editionNumberStates(fx.variantId)).filter((s) => s.state === 'reserved'),
        ).toHaveLength(1)

        await releaseEditionNumberForPaymentIntent(piId)

        const after = await editionNumberStates(fx.variantId)
        expect(after.filter((s) => s.state === 'reserved')).toHaveLength(0)
        expect(after.filter((s) => s.state === 'available')).toHaveLength(fx.editionSize)
      } finally {
        if (piId) await cancelPaymentIntent(piId)
        await teardownLimitedFixture(fx)
      }
    })
  })
})
