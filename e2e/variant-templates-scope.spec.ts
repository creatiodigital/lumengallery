import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * "Apply saved variant" must only ever offer the artist their OWN specs.
 *
 * A variant template carries an artist's chosen paper, sheet, border, edition
 * size and price — their commercial setup. Leaking one artist's template into
 * another artist's picker would expose that, and would let it be applied by
 * accident. The route scopes on `artwork: { userId }` of the TARGET artwork
 * (not the requester), so it stays correct for a superAdmin editing on an
 * artist's behalf too.
 *
 * The foreign template here is deliberately a FIXED SHEET, which applies to an
 * artwork of ANY aspect ratio. That removes the ratio filter as an explanation:
 * if it is absent from the response, ownership scoping is the only thing that
 * could have excluded it. The same-owner template is the positive control —
 * without it, an endpoint that always returned [] would pass this test.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

/** A fixed-sheet variant (applies to any ratio), so only ownership can filter it. */
async function addFixedSheetVariant(artworkId: string, name: string) {
  return prisma.limitedVariant.create({
    data: {
      artworkId,
      name,
      paperId: 'hahnemuhle-german-etching',
      printTypeId: 'giclee',
      // Image derived from a 40×50 sheet with a 7 cm minimum border.
      widthCm: 36,
      heightCm: 24.2,
      borderCm: 7,
      sheetWidthCm: 50,
      sheetHeightCm: 40,
      editionSize: 100,
      priceCents: 30000,
      published: false,
      blocked: false,
      order: 1,
    },
    select: { id: true },
  })
}

async function createLimitedArtworkFor(userId: string, slug: string) {
  return prisma.artwork.create({
    data: {
      name: 'E2E Template Source',
      slug,
      title: 'E2E Template Source',
      userId,
      originalWidth: 6000,
      originalHeight: 4000,
      printEnabled: true,
      editionType: 'limited',
    },
    select: { id: true },
  })
}

test('a variant template never crosses from one artist to another', async ({ page }) => {
  // Target: an artwork owned by the signed-in e2e artist.
  const fx = await setupLimitedFixture(3)

  const owner = await prisma.artwork.findUnique({
    where: { id: fx.artworkId },
    select: { userId: true },
  })
  const ownerId = owner!.userId

  // Some OTHER user with artworks of their own — never the target's owner.
  const otherUser = await prisma.user.findFirst({
    where: { id: { not: ownerId }, userType: 'artist' },
    select: { id: true },
  })
  test.skip(!otherUser, 'needs a second artist account in the dev DB')

  const stamp = Date.now().toString(36)
  const mine = await createLimitedArtworkFor(ownerId, `e2e-tpl-mine-${stamp}`)
  const theirs = await createLimitedArtworkFor(otherUser!.id, `e2e-tpl-theirs-${stamp}`)

  const MY_TEMPLATE = `E2E Mine ${stamp}`
  const THEIR_TEMPLATE = `E2E Theirs ${stamp}`

  try {
    await addFixedSheetVariant(mine.id, MY_TEMPLATE)
    await addFixedSheetVariant(theirs.id, THEIR_TEMPLATE)

    const res = await page.request.get(`/api/artworks/${fx.artworkId}/variant-templates`)
    expect(res.ok(), `templates request failed: ${res.status()}`).toBe(true)
    const body = await res.json()
    const names: string[] = (body.templates ?? []).map((t: { name: string }) => t.name)

    // Positive control: my own fixed-sheet template IS offered.
    expect(names, 'the artist should be offered their own saved variant').toContain(MY_TEMPLATE)

    // The point of the test.
    expect(names, 'another artist’s template must never be offered').not.toContain(THEIR_TEMPLATE)

    // Nothing in the payload should belong to the other artist either — the
    // source artwork title travels with each template, so check that too.
    const sources: string[] = (body.templates ?? []).map(
      (t: { sourceArtworkTitle: string }) => t.sourceArtworkTitle,
    )
    const foreignArtworkIds = await prisma.artwork.findMany({
      where: { userId: otherUser!.id },
      select: { title: true },
    })
    const foreignTitles = new Set(foreignArtworkIds.map((a) => a.title).filter(Boolean))
    for (const s of sources) {
      expect(foreignTitles.has(s), `template sourced from another artist: ${s}`).toBe(false)
    }
  } finally {
    await prisma.artwork.deleteMany({ where: { id: { in: [mine.id, theirs.id] } } })
    await teardownLimitedFixture(fx)
  }
})

test('the picker never offers the artwork you are editing', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  try {
    // A fixed-sheet variant ON THE TARGET ITSELF — applicable by ratio, owned
    // by the right artist, and still must not be offered: applying an artwork's
    // own variant to itself would only ever produce a duplicate size.
    const SELF = `E2E Self ${Date.now().toString(36)}`
    await addFixedSheetVariant(fx.artworkId, SELF)

    const res = await page.request.get(`/api/artworks/${fx.artworkId}/variant-templates`)
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const names: string[] = (body.templates ?? []).map((t: { name: string }) => t.name)
    expect(names).not.toContain(SELF)
  } finally {
    await teardownLimitedFixture(fx)
  }
})
