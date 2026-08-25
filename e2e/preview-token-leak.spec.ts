import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * `previewToken` is a credential, not metadata.
 *
 * It is the single secret that unlocks an UNPUBLISHED show: hand someone
 * `?preview=<token>` and they see a work-in-progress exhibition that the artist
 * has not announced. `api/exhibitions/[id]/route.ts` strips it before returning,
 * with the comment "must never be returned to anyone else" — and asserts that
 * the public visit path applies the same gate.
 *
 * It did not. `getExhibition()` used `include` with no `select`/`omit`, so every
 * Exhibition scalar materialised, and both response paths spread it verbatim.
 * A plain anonymous GET of any published show returned a live, working token.
 *
 * That matters after the fact, not just during the draft: publishing never
 * clears the token, so a token scraped while a show was public keeps working if
 * the show is later unpublished — the owner believes it is offline and it is not.
 *
 * The second test is the positive control. Omitting a field is easy; omitting it
 * without breaking the feature it belongs to is the actual job. If the preview
 * gate stops honouring a valid token, that test fails and this one still passes,
 * which is exactly the pair of signals worth having.
 */

const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

async function fixtureOwnerId() {
  const artwork = await prisma.artwork.findFirst({
    where: { slug: fixtures.artworkSlug },
    select: { userId: true },
  })
  return artwork?.userId ?? null
}

async function createExhibition(opts: { userId: string; published: boolean; token: string }) {
  const s = stamp()
  return prisma.exhibition.create({
    data: {
      userId: opts.userId,
      handler: `e2e-pt-${s}`,
      mainTitle: 'E2E Preview Token Leak',
      url: `e2e-preview-token-${s}`,
      spaceId: 'paris',
      status: 'draft',
      published: opts.published,
      previewEnabled: true,
      previewToken: opts.token,
    },
    select: { id: true, url: true },
  })
}

test('a published exhibition never hands out its preview token', async ({ request }) => {
  const userId = await fixtureOwnerId()
  test.skip(!userId, 'needs the fixture artwork/artist in the dev DB')

  const TOKEN = `e2e-token-${stamp()}`
  const ex = await createExhibition({ userId: userId!, published: true, token: TOKEN })

  try {
    const res = await request.get(`/api/exhibitions/by-url/${ex.url}`)
    expect(res.ok(), `public read failed: ${res.status()}`).toBe(true)

    const body = await res.json()

    // Positive control: we really are looking at the right exhibition, so an
    // absent token means "omitted" and not "wrong row" or "empty response".
    expect(body.mainTitle).toBe('E2E Preview Token Leak')

    expect(body.previewToken, 'previewToken must never reach a public caller').toBeUndefined()

    // The raw body is the real assertion — a token nested anywhere in the
    // payload is just as leaked as one at the top level.
    expect(JSON.stringify(body)).not.toContain(TOKEN)
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: ex.id } })
  }
})

test.describe('publishing retires the preview token', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('publishing a show clears the token that unlocked its draft', async ({ request }) => {
    const userId = await fixtureOwnerId()
    test.skip(!userId, 'needs the fixture artwork/artist in the dev DB')

    // A draft with a live preview link — the normal state before an opening.
    const TOKEN = `e2e-token-${stamp()}`
    const ex = await createExhibition({ userId: userId!, published: false, token: TOKEN })

    try {
      // Publishing is the moment the token stops having a job: the show is open
      // to everyone. Leaving it live means a token scraped during the draft
      // still opens the show if it is ever unpublished again — a back door the
      // owner cannot see and, because the UI hides the rotate control while a
      // show is published, cannot close either.
      const res = await request.put(`/api/exhibitions/${ex.id}`, {
        data: { published: true },
      })
      expect(res.ok(), `publish failed: ${res.status()}`).toBe(true)

      const after = await prisma.exhibition.findUnique({
        where: { id: ex.id },
        select: { previewToken: true, previewEnabled: true, published: true },
      })

      // Positive control: the publish actually happened, so a cleared token
      // means "retired on publish" rather than "the request did nothing".
      expect(after?.published).toBe(true)

      expect(after?.previewToken, 'publishing must clear the preview token').toBeNull()
      expect(after?.previewEnabled, 'publishing must turn preview off').toBe(false)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: ex.id } })
    }
  })
})

test('the preview link still opens an unpublished show, and only with the right token', async ({
  request,
}) => {
  const userId = await fixtureOwnerId()
  test.skip(!userId, 'needs the fixture artwork/artist in the dev DB')

  const TOKEN = `e2e-token-${stamp()}`
  const ex = await createExhibition({ userId: userId!, published: false, token: TOKEN })

  try {
    const withToken = await request.get(`/api/exhibitions/by-url/${ex.url}?preview=${TOKEN}`)
    expect(withToken.status(), 'a valid preview token must still open the show').toBe(200)

    const wrongToken = await request.get(`/api/exhibitions/by-url/${ex.url}?preview=not-the-token`)
    expect(wrongToken.status(), 'a wrong token must not open an unpublished show').toBe(404)

    const noToken = await request.get(`/api/exhibitions/by-url/${ex.url}`)
    expect(noToken.status(), 'no token must not open an unpublished show').toBe(404)
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: ex.id } })
  }
})
