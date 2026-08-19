import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { deleteR2KeyDirect, getR2ObjectSize, uploadToR2 } from '@/lib/r2'

/** Artwork blobs live in the PUBLIC bucket, so existence is a head on that one —
 *  r2ObjectExists() heads the private invoice bucket and would always say no. */
const publicObjectExists = async (key: string) => (await getR2ObjectSize(key)) !== null

import { fixtures } from './fixtures'

/**
 * Deleting an artwork must remove it EVERYWHERE — not just from the artist's
 * library.
 *
 * An artwork is referenced from four different kinds of place, and only three
 * of them are protected by the database:
 *   - its own row and the artist's library      → the delete itself
 *   - ExhibitionArtwork placements              → FK cascade
 *   - PrintOrder / PrintOrderItem               → FK Restrict (blocks deletion)
 *   - Exhibition.autofocusGroups                → JSON. NOTHING protects this.
 *
 * That last one is the reason this spec exists: `autofocusGroups` stores raw
 * artworkIds inside a JSON column, so a foreign key cannot reach them and a
 * deleted artwork leaves its id behind in every exhibition that grouped it.
 *
 * The R2 blobs matter too: an artwork carries a web image AND a high-res
 * original that is often tens of megabytes. Orphaning those on every delete is
 * how a bucket quietly fills with files nobody can trace back to anything.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

type Fixture = {
  artworkId: string
  artworkSlug: string
  exhibitionId: string
  imageKey: string
  otherArtworkId: string
}

async function setupFixture(): Promise<Fixture> {
  const base = await prisma.artwork.findUnique({
    where: { slug: fixtures.artworkSlug },
    select: { userId: true },
  })
  if (!base) throw new Error(`Fixture artwork "${fixtures.artworkSlug}" not found — check dev DB`)

  const stamp = `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}`

  // A REAL object in R2, so "the file is gone" is a fact and not a mock.
  const imageKey = `staging/test/artwork-delete-${stamp}.png`
  const imageUrl = await uploadToR2(imageKey, Buffer.from('e2e-delete-cascade-pixel'), 'image/png')

  const artwork = await prisma.artwork.create({
    data: {
      name: 'E2E Delete Cascade',
      slug: `e2e-delete-cascade-${stamp}`,
      title: 'E2E Delete Cascade',
      userId: base.userId,
      imageUrl,
    },
    select: { id: true, slug: true },
  })

  // A second artwork that must SURVIVE — proves the cleanup is surgical and
  // doesn't wipe the whole group.
  const other = await prisma.artwork.create({
    data: {
      name: 'E2E Delete Cascade Bystander',
      slug: `e2e-delete-bystander-${stamp}`,
      title: 'E2E Delete Cascade Bystander',
      userId: base.userId,
    },
    select: { id: true },
  })

  const exhibition = await prisma.exhibition.create({
    data: {
      userId: base.userId,
      handler: `e2e-del-${stamp}`,
      mainTitle: 'E2E Delete Cascade Exhibition',
      url: `e2e-delete-cascade-${stamp}`,
      spaceId: 'paris',
      status: 'draft',
      // The artwork is grouped for autofocus — the JSON a cascade can't reach.
      autofocusGroups: [
        { id: 'group-1', name: 'Main wall', artworkIds: [artwork.id, other.id] },
        { id: 'group-2', name: 'Side wall', artworkIds: [artwork.id] },
      ],
    },
    select: { id: true },
  })

  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      wallId: 'wall-1',
      posX2d: 0,
      posY2d: 0,
      width2d: 100,
      height2d: 80,
      posX3d: 0,
      posY3d: 1.5,
      posZ3d: -2,
      quaternionX: 0,
      quaternionY: 0,
      quaternionZ: 0,
      quaternionW: 1,
    },
  })

  return {
    artworkId: artwork.id,
    artworkSlug: artwork.slug,
    exhibitionId: exhibition.id,
    imageKey,
    otherArtworkId: other.id,
  }
}

async function teardownFixture(f: Fixture | null): Promise<void> {
  if (!f) return
  try {
    await prisma.exhibition.deleteMany({ where: { id: f.exhibitionId } })
    await prisma.artwork.deleteMany({ where: { id: { in: [f.artworkId, f.otherArtworkId] } } })
    if (await publicObjectExists(f.imageKey)) await deleteR2KeyDirect(f.imageKey)
  } catch (err) {
    console.warn('[e2e cleanup] artwork delete fixture:', err instanceof Error ? err.message : err)
  }
}

test.describe('Deleting an artwork removes every trace of it', () => {
  test('row, exhibition placement, R2 blob and autofocus membership all go', async ({ page }) => {
    test.setTimeout(120_000)

    let f: Fixture | null = null
    try {
      f = await setupFixture()

      // Precondition: the blob really is there before we delete anything.
      expect(await publicObjectExists(f.imageKey), 'fixture image uploaded to R2').toBe(true)

      const res = await page.request.delete(`/api/artworks/${f.artworkId}`)
      expect(res.status(), `delete should succeed: ${await res.text()}`).toBe(200)

      // 1. The artwork itself.
      const row = await prisma.artwork.findUnique({ where: { id: f.artworkId } })
      expect(row, 'artwork row is gone').toBeNull()

      // 2. Its placement in the exhibition (FK cascade).
      const placements = await prisma.exhibitionArtwork.count({ where: { artworkId: f.artworkId } })
      expect(placements, 'exhibition placements are gone').toBe(0)

      // 3. The public page no longer resolves.
      const pageRes = await page.request.get(`/artworks/${f.artworkSlug}`)
      expect(pageRes.status(), 'artwork page 404s').toBe(404)

      // 4. The R2 blob — an orphaned original is often tens of MB.
      expect(await publicObjectExists(f.imageKey), 'R2 object deleted').toBe(false)

      // 5. The JSON no foreign key can reach.
      const exhibition = await prisma.exhibition.findUnique({
        where: { id: f.exhibitionId },
        select: { autofocusGroups: true },
      })
      const groups = (exhibition?.autofocusGroups ?? []) as {
        id: string
        name: string
        artworkIds: string[]
      }[]
      const stillReferenced = groups.filter((g) => g.artworkIds.includes(f!.artworkId))
      expect(
        stillReferenced.map((g) => g.id),
        'no autofocus group may still reference the deleted artwork',
      ).toEqual([])

      // …and the cleanup must be surgical: the bystander keeps its membership,
      // and the groups themselves survive rather than being dropped wholesale.
      expect(groups.map((g) => g.id), 'both groups still exist').toEqual(['group-1', 'group-2'])
      expect(
        groups.find((g) => g.id === 'group-1')?.artworkIds,
        'the other artwork keeps its place in the group',
      ).toEqual([f.otherArtworkId])
    } finally {
      await teardownFixture(f)
    }
  })
})
