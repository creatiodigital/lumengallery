import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * `GET /api/artworks/[id]` is unauthenticated, and was returning the private
 * edition ledger to anyone who asked.
 *
 * The handler makes no `auth()` call at all — the only gates in that file are on
 * PUT and DELETE. `PUBLIC_ARTWORK_OMIT` is applied, so the author knowingly
 * treated this as a public read and hardened it against the master-image leak.
 * What was never revisited is the relation added underneath:
 * `include: { limitedVariants: { orderBy } }`, with no `where` and no `select`.
 *
 * So every variant came back in full regardless of state:
 *   - `published: false` — DRAFT editions the artist has not announced, with
 *     their size, edition size and `priceCents` (documented in the schema as the
 *     artist's cut for that variant)
 *   - `blocked: false` — editions an admin has paused from sale
 * plus `committedCount` / `soldCount` from two ungated aggregations, which is
 * live per-variant sales telemetry available nowhere else publicly. Because the
 * sold count includes rows with an `orderItemId`, it ticks at card
 * AUTHORIZATION — an observer polling this endpoint sees a sale before the
 * gallery has placed it with the lab.
 *
 * Artwork ids are public (the prints listing returns them), so this was one hop
 * from any gallery URL. Confirmed live in production on 2026-08-25: an anonymous
 * GET returned `printPriceCents: 25000`.
 *
 * The fix forks on privilege rather than simply requiring a session, because the
 * dashboard and wall-view editors are real consumers of this route. The
 * privileged tests below are the control that keeps that true.
 */

const PRIVATE_VARIANT_FIELDS = ['published', 'blocked', 'order', 'soldCount', 'committedCount']

async function addDraftVariant(artworkId: string, name: string) {
  return prisma.limitedVariant.create({
    data: {
      artworkId,
      name,
      paperId: 'hahnemuhle-german-etching',
      printTypeId: 'giclee',
      widthCm: 36,
      heightCm: 24.2,
      borderCm: 7,
      sheetWidthCm: 50,
      sheetHeightCm: 40,
      editionSize: 25,
      priceCents: 44400,
      // The point: never announced, never on sale.
      published: false,
      blocked: false,
      order: 99,
    },
    select: { id: true },
  })
}

test.describe('anonymous', () => {
  test('an unauthenticated read exposes neither the artist cut nor draft editions', async ({
    request,
  }) => {
    const fx = await setupLimitedFixture(3)
    const DRAFT = `E2E Unannounced ${Date.now().toString(36)}`

    try {
      await addDraftVariant(fx.artworkId, DRAFT)

      const res = await request.get(`/api/artworks/${fx.artworkId}`)
      expect(res.ok(), `public read failed: ${res.status()}`).toBe(true)
      const body = await res.json()

      // Positive control: this really is the artwork, so an absent field means
      // omitted rather than "wrong row".
      expect(body.id).toBe(fx.artworkId)

      expect(
        body.printPriceCents,
        "the artist's cut must not reach an anonymous caller",
      ).toBeUndefined()

      const names = (body.limitedVariants ?? []).map((v: { name: string }) => v.name)
      expect(names, 'an unannounced draft edition must never be listed publicly').not.toContain(
        DRAFT,
      )

      for (const variant of body.limitedVariants ?? []) {
        for (const field of PRIVATE_VARIANT_FIELDS) {
          expect(variant[field], `${field} is admin-only telemetry`).toBeUndefined()
        }
        expect(variant.priceCents, "per-variant artist cut must not be public").toBeUndefined()
      }
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})

test.describe('as the owning artist', () => {
  test.use({ storageState: 'e2e/.auth/artist.json' })

  test('the editor still receives drafts, prices and sales counts', async ({ request }) => {
    const fx = await setupLimitedFixture(3)
    const DRAFT = `E2E Owner Draft ${Date.now().toString(36)}`

    try {
      await addDraftVariant(fx.artworkId, DRAFT)

      const res = await request.get(`/api/artworks/${fx.artworkId}`)
      expect(res.ok(), `owner read failed: ${res.status()}`).toBe(true)
      const body = await res.json()

      // Everything the dashboard editor depends on must survive the fix — this
      // is the test that stops the leak being "fixed" by breaking the product.
      const names = (body.limitedVariants ?? []).map((v: { name: string }) => v.name)
      expect(names, 'the owner must still see their own draft').toContain(DRAFT)

      const draft = body.limitedVariants.find((v: { name: string }) => v.name === DRAFT)
      expect(draft.priceCents).toBe(44400)
      expect(draft.published).toBe(false)

      // The delete-guard badge needs these counts.
      for (const variant of body.limitedVariants) {
        expect(typeof variant.committedCount).toBe('number')
        expect(typeof variant.soldCount).toBe('number')
      }
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
