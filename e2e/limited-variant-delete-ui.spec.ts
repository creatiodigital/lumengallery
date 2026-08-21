import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * THE regression test for the delete-a-variant bug (2026-08-21).
 *
 * Reported as: "I delete a variant → it disappears. I reload the page → it
 * appears again." The cause was entirely client-side — "Delete variant" only
 * called `onChange` on the dashboard form's React state, so the row vanished
 * from the screen and the database never heard about it. It came back on any
 * reload unless the artist happened to go on and save the whole artwork.
 *
 * That means a server-side test CANNOT catch this bug: `saveLimitedVariants`
 * deleted correctly the whole time. Only driving the real browser does, so
 * this spec does the full round trip through the dashboard UI:
 *
 *     add a variant → save → reload (it persisted)
 *       → delete it → confirm → RELOAD → it is still gone
 *
 * The final reload is the assertion that matters. Before the fix it failed
 * exactly as reported.
 *
 * Fixture: a THROWAWAY limited artwork owned by the e2e artist, deleted at
 * the end. The shared `landscape-and-river-52416` fixture is treated as
 * read-only by the whole suite, and a test that adds and deletes variants
 * must not be the one to break that.
 *
 * No WebGL: the dashboard edit form is plain DOM — no wizard scene, no R3F.
 */

test.use({ storageState: 'e2e/.auth/artist.json' })

// Distinct enough to locate its card by name without matching the fixture's.
const VARIANT_NAME = 'E2E Delete Me'
// The fixture variant is 40 cm on the long edge; this one must differ (sizes
// must be distinct across a limited edition's variants). Width is derived by
// the aspect lock from the artwork's real ratio.
const HEIGHT_CM = '50'
const PRICE_EUROS = '300'

test('a deleted variant stays deleted after a reload', async ({ page }) => {
  const fx = await setupLimitedFixture(3)

  try {
    // The cookie banner would otherwise overlay the confirm modal's buttons.
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${fx.artworkId}/edit`)

    // ── 1. Add a variant through the UI ──────────────────────────────
    const addVariant = page.getByRole('button', { name: /\+ Add variant/i })
    await expect(addVariant).toBeVisible()
    await addVariant.click()

    // The new card opens expanded; the fixture's live variant stays collapsed,
    // so the freshly-revealed fields are the only ones on screen. `.last()`
    // guards against that ever changing.
    await page.getByPlaceholder('e.g. Small').last().fill(VARIANT_NAME)
    await page.getByLabel('Custom print height in centimeters').last().fill(HEIGHT_CM)
    // Blur so the aspect lock commits the derived width before we save.
    await page.getByLabel('Custom print height in centimeters').last().blur()
    await page.getByPlaceholder('Add your price here').last().fill(PRICE_EUROS)

    // ── 2. Save, and prove it actually persisted ─────────────────────
    await page.getByRole('button', { name: /^Save$/ }).click()
    // A successful save navigates back to the artwork list. If validation
    // rejected the variant we stay put — fail loudly here rather than later.
    await page.waitForURL('**/dashboard/artworks', { timeout: 15000 })

    const created = await prisma.limitedVariant.findFirst({
      where: { artworkId: fx.artworkId, name: VARIANT_NAME },
      select: { id: true, published: true, heightCm: true },
    })
    expect(created, 'the new variant should have been saved to the database').not.toBeNull()
    expect(created?.published, 'a newly added variant is a draft, not on sale').toBe(false)

    // ── 3. Reload the editor and delete it ───────────────────────────
    await page.goto(`/dashboard/artworks/${fx.artworkId}/edit`)

    // Saved variants come back collapsed — open the card to reach its footer.
    const card = page.getByRole('button', { name: new RegExp(VARIANT_NAME, 'i') })
    await expect(card, 'the saved variant should be listed after a reload').toBeVisible()
    await card.click()

    // The fixture's own variant is live (published + blocked), so it shows no
    // delete control — this is the only one on the page.
    const deleteButton = page.getByRole('button', { name: /Delete variant/i })
    await expect(deleteButton).toHaveCount(1)
    await deleteButton.click()

    // Destructive actions are confirmed, never immediate on click. Scope to the
    // dialog: the edit form has its own Cancel/Save pair behind the overlay.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Delete this variant?')).toBeVisible()
    await dialog.getByRole('button', { name: /Yes, delete it/i }).click()

    // It leaves the form straight away.
    await expect(page.getByRole('button', { name: new RegExp(VARIANT_NAME, 'i') })).toHaveCount(0)

    // ── 4. The actual regression: RELOAD, and it must still be gone ──
    await page.reload()
    // Wait for the editor to have actually rendered its variant list before
    // asserting an ABSENCE — the fixture's own variant is always there. Without
    // this anchor, `toHaveCount(0)` passes on the empty pre-hydration DOM and
    // the test would go green against the very bug it exists to catch.
    await expect(
      page.getByRole('button', { name: /E2E Small/i }),
      'the variant list should have rendered before we assert what is missing',
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: new RegExp(VARIANT_NAME, 'i') }),
      'the deleted variant must NOT come back on reload — no artwork save was performed',
    ).toHaveCount(0)

    // And it is genuinely gone from the database, not merely hidden.
    expect(
      await prisma.limitedVariant.count({ where: { id: created!.id } }),
      'the variant row should be deleted, without needing an artwork save',
    ).toBe(0)
  } finally {
    await teardownLimitedFixture(fx)
  }
})

test('deleting is confirmed first, and cancelling keeps the variant', async ({ page }) => {
  const fx = await setupLimitedFixture(3)

  try {
    // A second draft variant, created directly — this test is about the
    // confirm gate, not about the add-and-save path the test above covers.
    const draft = await prisma.limitedVariant.create({
      data: {
        artworkId: fx.artworkId,
        name: 'E2E Keep Me',
        paperId: 'hahnemuhle-german-etching',
        printTypeId: 'giclee',
        widthCm: fx.widthCm / 2,
        heightCm: fx.heightCm / 2,
        borderCm: 3,
        editionSize: 5,
        priceCents: 30000,
        published: false,
        blocked: false,
        order: 1,
      },
      select: { id: true },
    })

    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${fx.artworkId}/edit`)

    // No native confirm()/alert() anywhere in this flow.
    let nativeDialogFired = false
    page.on('dialog', (d) => {
      nativeDialogFired = true
      d.dismiss().catch(() => {})
    })

    await page.getByRole('button', { name: /E2E Keep Me/i }).click()
    await page.getByRole('button', { name: /Delete variant/i }).click()

    // Scope to the dialog — the edit form behind it has its own Cancel button.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Delete this variant?')).toBeVisible()
    expect(nativeDialogFired, 'the confirm must be in-app, not a native bubble').toBe(false)

    // Backing out deletes nothing.
    await dialog.getByRole('button', { name: /^Cancel$/i }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    expect(
      await prisma.limitedVariant.count({ where: { id: draft.id } }),
      'cancelling the confirm must leave the variant alone',
    ).toBe(1)
  } finally {
    await teardownLimitedFixture(fx)
  }
})

test('a variant that is on sale offers no delete control at all', async ({ page }) => {
  const fx = await setupLimitedFixture(3)

  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${fx.artworkId}/edit`)

    // The fixture's only variant is published + blocked = live. Open its card.
    await page.getByRole('button', { name: /E2E Small/i }).click()
    await expect(page.getByText(/This variant is on sale and frozen/i)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Delete variant/i }),
      'a live variant must not be deletable from the UI',
    ).toHaveCount(0)

    expect(await prisma.limitedVariant.count({ where: { id: fx.variantId } })).toBe(1)
  } finally {
    await teardownLimitedFixture(fx)
  }
})

/**
 * The delete gate must follow SALES, not the on-sale lock.
 *
 * Reported 2026-08-21: a variant an admin had unblocked showed no "Currently
 * Selling" badge and still offered "Delete variant" — but a real order owned
 * one of its numbers, so the server refused. The UI was promising something it
 * could not deliver, because the client only knew `published`/`blocked` and had
 * no idea any copy was committed. The GET now returns `committedCount`.
 */
test('an unblocked variant with a sold copy shows no delete button', async ({ page }) => {
  const fx = await setupLimitedFixture(3)

  try {
    // A plain draft sibling: it SHOULD keep its delete button, which proves the
    // gate is per-variant and not just "this page has no delete buttons".
    await prisma.limitedVariant.create({
      data: {
        artworkId: fx.artworkId,
        name: 'E2E Plain Draft',
        paperId: 'hahnemuhle-german-etching',
        printTypeId: 'giclee',
        widthCm: fx.widthCm / 2,
        heightCm: fx.heightCm / 2,
        borderCm: 3,
        editionSize: 5,
        priceCents: 30000,
        published: false,
        blocked: false,
        order: 1,
      },
    })

    // Admin took the fixture variant off sale — but copy 1 is already sold.
    await prisma.limitedVariant.update({
      where: { id: fx.variantId },
      data: { blocked: false },
    })
    await prisma.editionNumber.updateMany({
      where: { variantId: fx.variantId, number: 1 },
      data: { state: 'sold', soldAt: new Date() },
    })

    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${fx.artworkId}/edit`)

    // Not "Currently Selling" — it is paused. But it does carry a sale.
    await expect(page.getByText('Currently Selling')).toHaveCount(0)
    await expect(page.getByText(/1 sold · paused/i)).toBeVisible()

    await page.getByRole('button', { name: /E2E Small/i }).click()
    await expect(
      page.getByText(/already been reserved or sold, so it can’t be deleted/i),
    ).toBeVisible()

    // Exactly one delete button on the page: the plain draft's, not this one.
    await expect(
      page.getByRole('button', { name: /Delete variant/i }),
      'only the draft sibling should be deletable',
    ).toHaveCount(1)

    // And it really is the draft's — deleting it leaves the sold variant alone.
    await page.getByRole('button', { name: /E2E Plain Draft/i }).click()
    await expect(page.getByRole('button', { name: /Delete variant/i })).toHaveCount(1)
  } finally {
    await teardownLimitedFixture(fx)
  }
})
