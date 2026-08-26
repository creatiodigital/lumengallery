# Gallery Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the paginated `/prints` catalogue with a super-admin-curated, hand-ordered selection, managed from a new admin screen with a searchable artwork picker.

**Architecture:** A dedicated `SelectedPrint` table (`artworkId @unique` + `order`) mirrors the existing `Slide` model that backs the homepage hero — same shape, same reorder endpoint pattern. `/prints` becomes a server component reading that table. The admin screen is an ordered dnd-kit list with a modal picker over it. "Currently selling" is never redefined: every surface consumes the existing `resolveArtworkSale` / `purchasableArtworkWhere`.

**Tech Stack:** Next.js App Router (server components + route handlers), Prisma, Redux Toolkit Query (admin client only), `@dnd-kit/core` + `@dnd-kit/sortable`, Playwright for tests, SCSS modules.

**Spec:** `docs/superpowers/specs/2026-08-26-gallery-selection-design.md`

## Global Constraints

- **Tests are Playwright only**, living in `/e2e/`. No Vitest, Jest, or bun:test. Run locally; never wired into CI.
- **Never send email in e2e.** `SKIP_EMAILS=true` must be set on both dev server and runner. Nothing in this feature sends mail, but the rule is absolute.
- **Never mount WebGL in e2e** (the wizard's 3D view, the exhibition scene). Nothing here does.
- **Claude never runs or proposes a Prisma migration command.** Edit `schema.prisma`, then hand off to the owner to apply it. Task 1 has an explicit stop.
- **Admin/dashboard controls are rounded; public/buyer controls are squared.** This feature's admin screen is rounded.
- **Always use the shared `<Button>` component.** Never a raw `<button>`.
- **No emoji in UI.** Use `lucide-react` icons with `ICON_STROKE_WIDTH` from `@/lib/iconConfig`.
- **Never render `originalImageUrl`** — it is the 60+MB print master. Thumbnails use `imageUrl`.
- **No new dependencies** without explicit approval. Everything here uses packages already installed.
- **Write `var(--token)` in SCSS with no fallback value.** Never `var(--x, #fff)`.
- **Avoid `!important`.** Add a variant or refactor instead.
- **Do not commit until the owner has tested and confirmed.** Steps say "Commit" — perform the `git add`/`git commit` only when the owner has approved that task's work. Never push.
- **Public copy must never name theprintspace.**

---

## File Structure

**Created**

| Path                                                                 | Responsibility                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/queries/getGallerySelection.ts`                             | Both reads of the selection: public (visible only) and admin (all rows + why each is hidden). |
| `src/app/api/selected-prints/route.ts`                               | `GET` admin list, `POST` batch add.                                                           |
| `src/app/api/selected-prints/[id]/route.ts`                          | `DELETE` one entry.                                                                           |
| `src/app/api/selected-prints/reorder/route.ts`                       | `POST` ordered id array → index writes.                                                       |
| `src/app/admin/content/gallery-selection/page.tsx`                   | Route shell + super-admin guard.                                                              |
| `src/components/admin/GallerySelection/index.tsx`                    | Screen: selection list + picker orchestration.                                                |
| `src/components/admin/GallerySelection/SelectionList.tsx`            | dnd-kit sortable list, remove, flags, tally.                                                  |
| `src/components/admin/GallerySelection/AddArtworksModal.tsx`         | The two-mode picker.                                                                          |
| `src/components/admin/GallerySelection/GallerySelection.module.scss` | Styles for the three above.                                                                   |
| `e2e/gallery-selection.spec.ts`                                      | Data-layer + API tests.                                                                       |
| `e2e/gallery-selection-admin.spec.ts`                                | Browser tests for the admin screen.                                                           |

**Modified**

| Path                              | Change                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`            | Add `SelectedPrint`; add back-relation on `Artwork`.                                        |
| `src/app/prints/page.tsx`         | Read the selection instead of the catalogue page.                                           |
| `src/components/prints/index.tsx` | Drop browser/filters, add subtitle + empty state.                                           |
| `src/app/prints/actions.ts`       | `getPrintsCatalogPage` gains `search` + `excludeIds`; `getPrintArtistOptions` gains counts. |
| `e2e/prints-pagination.spec.ts`   | Re-point at the picker's action; the public page no longer paginates.                       |

**Deleted**

| Path                                      | Why                                             |
| ----------------------------------------- | ----------------------------------------------- |
| `src/components/prints/PrintsBrowser.tsx` | The public page no longer paginates or filters. |
| `src/components/prints/PrintsToolbar.tsx` | Its filters move into the picker.               |

`getPrintsCatalogPage` stays in `src/app/prints/actions.ts` even though its only consumer becomes the admin picker. Moving it would churn two passing spec files for no functional gain; a comment records the new owner.

---

## Task 1: `SelectedPrint` model and the two reads

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `src/lib/queries/getGallerySelection.ts`
- Test: `e2e/gallery-selection.spec.ts`

**Interfaces:**

- Consumes: `resolveArtworkSale`, `SALE_SELECT`, `saleFromRow` from `@/lib/editions/artworkSale`; `ArtworkSale` type.
- Produces:
  - `getGallerySelection(): Promise<GallerySelectionCard[]>` — public, visible works only, ordered.
  - `getGallerySelectionForAdmin(): Promise<AdminSelectionRow[]>` — every row, ordered, each with `status`.
  - `type GallerySelectionCard = { id, slug, name, title, author, year, technique, dimensions, imageUrl, originalWidth, originalHeight, sale: ArtworkSale }`
  - `type SelectionStatus = 'live' | 'sold-out' | 'not-for-sale'`
  - `type AdminSelectionRow = { selectionId: string; order: number; status: SelectionStatus; artwork: Omit<GallerySelectionCard, 'sale'> & { sale: ArtworkSale | null }; artistName: string }`
    — NOTE: `artwork.sale` is nullable on the ADMIN row (a not-for-sale entry has none) but non-null on `GallerySelectionCard`, which only ever describes work that is on the page. `artistName` is pre-joined so the admin screen needs no second lookup.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Append near `model Slide`:

```prisma
// One curated entry on /prints. The gallery's own selection, ordered by hand.
// Mirrors `Slide` (the homepage hero) deliberately: same shape, same reorder
// endpoint pattern. `artworkId @unique` makes double-adding impossible and
// onDelete: Cascade means a deleted artwork cannot leave a ghost in the list.
model SelectedPrint {
  id        String   @id @default(uuid())
  artworkId String   @unique
  artwork   Artwork  @relation(fields: [artworkId], references: [id], onDelete: Cascade)
  order     Int      @default(0)
  createdAt DateTime @default(now())
}
```

Add the back-relation inside `model Artwork` (near `limitedVariants`):

```prisma
  selectedPrint SelectedPrint?
```

- [ ] **Step 2: STOP — hand the schema change to the owner**

Do not run any Prisma command. Tell the owner the schema is edited and needs
applying to the dev database, then wait for confirmation before continuing.
Everything below fails until the table exists.

- [ ] **Step 3: Write the failing test**

Create `e2e/gallery-selection.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

import { getGallerySelection, getGallerySelectionForAdmin } from '@/lib/queries/getGallerySelection'
import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * The selection is the whole of /prints, so what it returns IS the shop.
 *
 * Two conditions get a work onto the page: currently selling, and in the
 * selection. "Currently selling" is TRUE of a SOLD-OUT edition — the work is on
 * sale, there is simply nothing left of it — so those stay, marked. Only work
 * that is not for sale at all is hidden: an Order Print button there is a dead
 * end, and there is no story to tell.
 */
async function select(artworkId: string, order = 0) {
  return prisma.selectedPrint.create({ data: { artworkId, order } })
}

test('a live selected print appears publicly, priced', async () => {
  const fx = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title: `E2E Sel Live ${fx.slug}` },
    })
    await select(fx.artworkId)

    const card = (await getGallerySelection()).find((c) => c.id === fx.artworkId)
    expect(card, 'a live selected print belongs on the page').toBeTruthy()
    expect(card!.sale.minPriceCents).toBeGreaterThan(0)
  } finally {
    await teardownLimitedFixture(fx)
  }
})

test('a sold-out selected print STAYS on the page, marked, and is counted in admin', async () => {
  const fx = await setupLimitedFixture(2)
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title: `E2E Sel SoldOut ${fx.slug}` },
    })
    await select(fx.artworkId)
    await prisma.editionNumber.updateMany({
      where: { variantId: fx.variantId },
      data: { state: 'sold' },
    })

    const card = (await getGallerySelection()).find((c) => c.id === fx.artworkId)
    expect(card, 'a sold edition is the best thing on the page — it stays').toBeTruthy()
    expect(card!.sale.minPriceCents, 'no price: the grid shows "Sold out", not a CTA').toBeNull()

    const row = (await getGallerySelectionForAdmin()).find((r) => r.artwork.id === fx.artworkId)
    expect(row?.status, 'the curator sees it sold, and can weigh the ratio').toBe('sold-out')
  } finally {
    await teardownLimitedFixture(fx)
  }
})

test('a print-disabled selected work reads as not-for-sale, not sold-out', async () => {
  const fx = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printEnabled: false, title: `E2E Sel Off ${fx.slug}` },
    })
    await select(fx.artworkId)

    expect((await getGallerySelection()).map((c) => c.id)).not.toContain(fx.artworkId)
    const row = (await getGallerySelectionForAdmin()).find((r) => r.artwork.id === fx.artworkId)
    expect(row?.status, 'never sold, so "sold out" would invent a history').toBe('not-for-sale')
  } finally {
    await teardownLimitedFixture(fx)
  }
})

test('the selection is returned in the admin order, not by date added', async () => {
  const a = await setupLimitedFixture(3)
  const b = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({ where: { id: a.artworkId }, data: { printPriceCents: null } })
    await prisma.artwork.update({ where: { id: b.artworkId }, data: { printPriceCents: null } })
    await select(a.artworkId, 10) // added first, ordered last
    await select(b.artworkId, 1)

    const ids = (await getGallerySelection()).map((c) => c.id)
    expect(ids.indexOf(b.artworkId)).toBeLessThan(ids.indexOf(a.artworkId))
  } finally {
    await teardownLimitedFixture(a)
    await teardownLimitedFixture(b)
  }
})

test('deleting an artwork removes its selection entry', async () => {
  const fx = await setupLimitedFixture(3)
  await prisma.artwork.update({ where: { id: fx.artworkId }, data: { printPriceCents: null } })
  await select(fx.artworkId)

  await prisma.artwork.delete({ where: { id: fx.artworkId } })

  const orphan = await prisma.selectedPrint.findFirst({ where: { artworkId: fx.artworkId } })
  expect(orphan, 'cascade prevents a ghost entry in the selection').toBeNull()
})

test('the same artwork cannot be selected twice', async () => {
  const fx = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({ where: { id: fx.artworkId }, data: { printPriceCents: null } })
    await select(fx.artworkId)
    await expect(select(fx.artworkId, 5)).rejects.toThrow()
  } finally {
    await teardownLimitedFixture(fx)
  }
})
```

- [ ] **Step 4: Run the tests and confirm they fail for the right reason**

Run: `npx playwright test gallery-selection --config=playwright.config.ts`
Expected: FAIL — cannot resolve `@/lib/queries/getGallerySelection`. Not a
Prisma error; if it says `selectedPrint` is undefined, the owner has not applied
the schema yet — return to Step 2.

- [ ] **Step 5: Implement the queries**

Create `src/lib/queries/getGallerySelection.ts`:

```typescript
import { SALE_SELECT, saleFromRow, type ArtworkSale } from '@/lib/editions/artworkSale'
import prisma from '@/lib/prisma'

/**
 * The gallery's own selection — the entire contents of /prints.
 *
 * Two reads, and the difference between them is the point. The public one shows
 * only what a buyer can complete right now; the admin one shows every entry with
 * the reason any of them has gone quiet, because a selection that silently
 * shrinks is one the curator cannot maintain.
 *
 * Neither restates what "currently selling" means. That lives in
 * `resolveArtworkSale`, and this consumes it.
 */

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  title: true,
  author: true,
  year: true,
  technique: true,
  dimensions: true,
  imageUrl: true,
  ...SALE_SELECT,
} as const

export type GallerySelectionCard = {
  id: string
  slug: string
  name: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  imageUrl: string | null
  originalWidth: number | null
  originalHeight: number | null
  sale: ArtworkSale
}

/** Why an entry is not on the page. `live` means it is. */
export type SelectionStatus = 'live' | 'sold-out' | 'not-for-sale'

export type AdminSelectionRow = {
  selectionId: string
  order: number
  status: SelectionStatus
  artwork: Omit<GallerySelectionCard, 'sale'> & { sale: ArtworkSale | null }
  artistName: string
}

const orderedRows = () =>
  prisma.selectedPrint.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      order: true,
      artwork: {
        select: {
          ...CARD_SELECT,
          user: { select: { name: true, lastName: true } },
        },
      },
    },
  })

function toCard(row: Awaited<ReturnType<typeof orderedRows>>[number]['artwork']) {
  const { limitedVariants, printEnabled, printPriceCents, editionType, user, ...rest } = row
  return {
    card: {
      ...rest,
      sale: saleFromRow({
        editionType,
        printEnabled,
        printPriceCents,
        originalWidth: rest.originalWidth,
        originalHeight: rest.originalHeight,
        limitedVariants,
      }),
    },
    artistName: [user.name, user.lastName].filter(Boolean).join(' ').trim(),
  }
}

/** What /prints renders: selected works that are currently selling — sold-out
 *  editions included, shown and marked. */
export async function getGallerySelection(): Promise<GallerySelectionCard[]> {
  const rows = await orderedRows()
  // `sale != null`, NOT `minPriceCents != null`. A sold-out edition stays on the
  // page — ArtworkGrid renders it as "Sold out" instead of a CTA — because a page
  // where editions have gone is the signal that editions move. Only work that is
  // not for sale at all (prints off, unpriced, every variant paused) is hidden:
  // no story there, and the CTA would be a dead end.
  return rows
    .map((row) => toCard(row.artwork).card)
    .filter((c): c is GallerySelectionCard => c.sale != null)
}

/** Every entry, with the reason any of them is hidden. */
export async function getGallerySelectionForAdmin(): Promise<AdminSelectionRow[]> {
  const rows = await orderedRows()
  return rows.map((row) => {
    const { card, artistName } = toCard(row.artwork)
    const status: SelectionStatus =
      card.sale == null ? 'not-for-sale' : card.sale.minPriceCents == null ? 'sold-out' : 'live'
    return { selectionId: row.id, order: row.order, status, artwork: card, artistName }
  })
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx playwright test gallery-selection --config=playwright.config.ts`
Expected: 6 passed.

- [ ] **Step 7: Typecheck, lint, format**

```bash
npx tsc --noEmit && npx eslint src/lib/queries/getGallerySelection.ts e2e/gallery-selection.spec.ts && npx prettier --write src/lib/queries/getGallerySelection.ts e2e/gallery-selection.spec.ts prisma/schema.prisma
```

- [ ] **Step 8: Commit** (only once the owner has confirmed)

```bash
git add prisma/schema.prisma src/lib/queries/getGallerySelection.ts e2e/gallery-selection.spec.ts
git commit -m "AR-140: the gallery's selection, and why an entry went quiet"
```

---

## Task 2: The four API routes

**Files:**

- Create: `src/app/api/selected-prints/route.ts`
- Create: `src/app/api/selected-prints/[id]/route.ts`
- Create: `src/app/api/selected-prints/reorder/route.ts`
- Test: `e2e/gallery-selection.spec.ts` (append)

**Interfaces:**

- Consumes: `getGallerySelectionForAdmin` (Task 1); `requireSuperAdmin` from `@/lib/authUtils`; `isArtworkPurchasable`, `LIVE_VARIANT_WHERE` from `@/lib/editions/printable`.
- Produces: `GET /api/selected-prints` → `AdminSelectionRow[]`; `POST /api/selected-prints` body `{ artworkIds: string[] }` → `{ added: number }` (PREPENDS); `DELETE /api/selected-prints/[id]` → `{ success: true }`; `POST /api/selected-prints/reorder` body `{ ids: string[] }` → `{ success: true }`.

- [ ] **Step 1: Write the failing test**

Append to `e2e/gallery-selection.spec.ts`:

```typescript
/**
 * The picker's idea of "sellable" can go stale while the modal sits open, so the
 * server checks again. A batch that would half-apply is refused whole: a
 * curator who pressed Add on five works and silently got four has a selection
 * they did not choose.
 */
test('adding a work that stopped selling is refused, and refuses the whole batch', async ({
  request,
}) => {
  const good = await setupLimitedFixture(3)
  const bad = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({ where: { id: good.artworkId }, data: { printPriceCents: null } })
    await prisma.artwork.update({
      where: { id: bad.artworkId },
      data: { printEnabled: false, printPriceCents: null },
    })

    const res = await request.post('/api/selected-prints', {
      data: { artworkIds: [good.artworkId, bad.artworkId] },
    })
    expect(res.status()).toBe(400)

    const none = await prisma.selectedPrint.findMany({
      where: { artworkId: { in: [good.artworkId, bad.artworkId] } },
    })
    expect(none, 'no partial application').toHaveLength(0)
  } finally {
    await teardownLimitedFixture(good)
    await teardownLimitedFixture(bad)
  }
})

test('a newly added work lands at the TOP, above what was already there', async ({ request }) => {
  const existing = await setupLimitedFixture(3)
  const added = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({
      where: { id: existing.artworkId },
      data: { printPriceCents: null },
    })
    await prisma.artwork.update({ where: { id: added.artworkId }, data: { printPriceCents: null } })

    const a = await request.post('/api/selected-prints', {
      data: { artworkIds: [existing.artworkId] },
    })
    expect(a.ok()).toBeTruthy()
    const b = await request.post('/api/selected-prints', {
      data: { artworkIds: [added.artworkId] },
    })
    expect(b.ok()).toBeTruthy()

    const rows = await prisma.selectedPrint.findMany({
      where: { artworkId: { in: [existing.artworkId, added.artworkId] } },
    })
    const orderOf = (artworkId: string) => rows.find((r) => r.artworkId === artworkId)!.order
    expect(
      orderOf(added.artworkId),
      'the work just added is the one the curator wants seen — it goes on top',
    ).toBeLessThan(orderOf(existing.artworkId))
  } finally {
    await prisma.selectedPrint.deleteMany({
      where: { artworkId: { in: [existing.artworkId, added.artworkId] } },
    })
    await teardownLimitedFixture(existing)
    await teardownLimitedFixture(added)
  }
})

test('reorder writes the given order', async ({ request }) => {
  const a = await setupLimitedFixture(3)
  const b = await setupLimitedFixture(3)
  try {
    await prisma.artwork.update({ where: { id: a.artworkId }, data: { printPriceCents: null } })
    await prisma.artwork.update({ where: { id: b.artworkId }, data: { printPriceCents: null } })
    const added = await request.post('/api/selected-prints', {
      data: { artworkIds: [a.artworkId, b.artworkId] },
    })
    expect(added.ok()).toBeTruthy()

    const rows = await prisma.selectedPrint.findMany({
      where: { artworkId: { in: [a.artworkId, b.artworkId] } },
    })
    const idOf = (artworkId: string) => rows.find((r) => r.artworkId === artworkId)!.id
    const res = await request.post('/api/selected-prints/reorder', {
      data: { ids: [idOf(b.artworkId), idOf(a.artworkId)] },
    })
    expect(res.ok()).toBeTruthy()

    const after = await prisma.selectedPrint.findMany({
      where: { artworkId: { in: [a.artworkId, b.artworkId] } },
    })
    const orderOf = (artworkId: string) => after.find((r) => r.artworkId === artworkId)!.order
    expect(orderOf(b.artworkId)).toBeLessThan(orderOf(a.artworkId))
  } finally {
    await teardownLimitedFixture(a)
    await teardownLimitedFixture(b)
  }
})
```

Add at the top of the file, under the imports:

```typescript
test.use({ storageState: 'e2e/.auth/admin.json' })
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx playwright test gallery-selection --config=playwright.config.ts`
Expected: the three new tests FAIL with 404 — the routes do not exist. Task 1's six must still pass.

- [ ] **Step 3: Implement `src/app/api/selected-prints/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import { isArtworkPurchasable, LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import { getGallerySelectionForAdmin } from '@/lib/queries/getGallerySelection'
import prisma from '@/lib/prisma'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error
  return NextResponse.json(await getGallerySelectionForAdmin())
}

/**
 * Batch add. Validated server-side even though the picker only offers sellable
 * work: the modal can sit open while an edition sells out. A batch containing
 * anything unsellable, unknown or already selected is refused WHOLE — a
 * silently partial add leaves a selection the curator did not choose.
 */
export async function POST(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = (await request.json()) as { artworkIds?: unknown }
  const ids = Array.isArray(body.artworkIds)
    ? body.artworkIds.filter((i) => typeof i === 'string')
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'artworkIds must be a non-empty array' }, { status: 400 })
  }

  const artworks = await prisma.artwork.findMany({
    where: { id: { in: ids as string[] } },
    select: {
      id: true,
      printEnabled: true,
      editionType: true,
      printPriceCents: true,
      limitedVariants: { where: LIVE_VARIANT_WHERE, select: { id: true } },
      selectedPrint: { select: { id: true } },
    },
  })

  if (artworks.length !== ids.length) {
    return NextResponse.json({ error: 'One or more artworks do not exist' }, { status: 400 })
  }

  const unusable = artworks.filter(
    (a) =>
      a.selectedPrint !== null ||
      !isArtworkPurchasable({
        printEnabled: a.printEnabled,
        editionType: a.editionType,
        printPriceCents: a.printPriceCents,
        liveVariantCount: a.limitedVariants.length,
      }),
  )
  if (unusable.length > 0) {
    return NextResponse.json(
      { error: 'One or more artworks are not currently selling, or are already selected' },
      { status: 400 },
    )
  }

  // PREPEND, preserving the order given. A work is added in order to be seen, so
  // appending would make every add a two-step action: add, then drag to the top.
  // Push everything already there down by exactly the number arriving, then slot
  // the new ones into 0..n-1 — one transaction, so no read sees a gap or a
  // collision. The curator drags from there.
  await prisma.$transaction([
    prisma.selectedPrint.updateMany({ data: { order: { increment: ids.length } } }),
    prisma.selectedPrint.createMany({
      data: (ids as string[]).map((artworkId, i) => ({ artworkId, order: i })),
    }),
  ])

  revalidatePath('/prints')
  return NextResponse.json({ added: ids.length }, { status: 201 })
}
```

- [ ] **Step 4: Implement `src/app/api/selected-prints/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params
  await prisma.selectedPrint.deleteMany({ where: { id } })

  revalidatePath('/prints')
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Implement `src/app/api/selected-prints/reorder/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * Same shape as /api/slides/reorder: the client sends the ids in their new
 * order and each row's `order` becomes its index, in one transaction so a
 * half-written order can never be read.
 */
export async function POST(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = (await request.json()) as { ids?: unknown }
  const ids = Array.isArray(body.ids) ? body.ids.filter((i) => typeof i === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  await prisma.$transaction(
    (ids as string[]).map((id, index) =>
      prisma.selectedPrint.update({ where: { id }, data: { order: index } }),
    ),
  )

  revalidatePath('/prints')
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx playwright test gallery-selection --config=playwright.config.ts`
Expected: 9 passed (Task 1's six plus these three).

- [ ] **Step 7: Typecheck, lint, format, then commit** (owner confirms first)

```bash
npx tsc --noEmit && npx eslint src/app/api/selected-prints && npx prettier --write "src/app/api/selected-prints/**/*.ts"
git add src/app/api/selected-prints e2e/gallery-selection.spec.ts
git commit -m "AR-140: selection API — batch add refuses whole, never half"
```

---

## Task 3: `/prints` becomes the selection

**Files:**

- Modify: `src/app/prints/page.tsx`
- Modify: `src/components/prints/index.tsx`
- Modify: `src/components/prints/prints.module.scss`
- Delete: `src/components/prints/PrintsBrowser.tsx`, `src/components/prints/PrintsToolbar.tsx`
- Modify: `e2e/prints-pagination.spec.ts`
- Test: `e2e/gallery-selection.spec.ts` (append)

**Interfaces:**

- Consumes: `getGallerySelection` (Task 1); `ArtworkGrid` from `@/components/artwork/ArtworkGrid` (unchanged — it already takes `sale` per card).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Append to `e2e/gallery-selection.spec.ts`:

```typescript
test('/prints renders the selection in order, and nothing else', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  const title = `E2E Prints Selected ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })
    await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })

    await page.goto('/prints')
    await expect(page.getByText(title)).toBeVisible()
    await expect(page.locator(`a[href="/artworks/${fx.slug}/print"]`)).toBeVisible()
    await expect(page.getByText('Gallery Selection')).toBeVisible()
    // The catalogue is gone: no filters, no pager.
    await expect(page.getByText('All artists')).toHaveCount(0)

    // Sell it out — it must STAY, swapping its CTA for the badge.
    await prisma.editionNumber.updateMany({
      where: { variantId: fx.variantId },
      data: { state: 'sold' },
    })
    await page.reload()
    await expect(page.getByText(title)).toBeVisible()
    await expect(page.getByText('Sold out')).toBeVisible()
    await expect(page.locator(`a[href="/artworks/${fx.slug}/print"]`)).toHaveCount(0)
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx playwright test gallery-selection -g "renders the selection" --config=playwright.config.ts`
Expected: FAIL — "Gallery Selection" not found, "All artists" still present.

- [ ] **Step 3: Rewrite `src/app/prints/page.tsx`**

```typescript
import type { Metadata } from 'next'

import { PrintsPage } from '@/components/prints'
import { getGallerySelection } from '@/lib/queries/getGallerySelection'
import prisma from '@/lib/prisma'
import { getPurchasesPaused } from '@/lib/settings'

export const metadata: Metadata = {
  title: { absolute: 'Prints · The Art Room' },
  description:
    'Order fine-art prints of selected works from The Art Room artists, produced on museum-grade paper.',
}

// Render per request so a change to the selection, a price, or the CMS copy
// shows immediately. No ISR / revalidate — by design.
export const dynamic = 'force-dynamic'

const Prints = async () => {
  const [paused, selection, pageRaw] = await Promise.all([
    getPurchasesPaused(),
    getGallerySelection(),
    prisma.pageContent.findUnique({ where: { slug: 'prints' } }),
  ])

  const pageContent = pageRaw
    ? {
        title: pageRaw.title,
        content: pageRaw.content ?? '',
        bannerImageUrl: pageRaw.bannerImageUrl ?? null,
      }
    : null

  // Kill switch: an empty selection renders the same quiet state as a selection
  // nobody can buy from, so pausing sales needs no per-artwork flag.
  return <PrintsPage selection={paused ? [] : selection} pageContent={pageContent} />
}

export default Prints
```

- [ ] **Step 4: Rewrite `src/components/prints/index.tsx`**

```typescript
import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import type { GallerySelectionCard } from '@/lib/queries/getGallerySelection'

import { PrintsBanner } from './PrintsBanner'
import styles from './prints.module.scss'
import type { PrintsPageContent } from './types'

interface PrintsPageProps {
  /** The gallery's selection, already ordered and already filtered to what a
   *  buyer can complete. Empty is a legitimate state, not an error. */
  selection: GallerySelectionCard[]
  pageContent: PrintsPageContent | null
}

export const PrintsPage = ({ selection, pageContent }: PrintsPageProps) => {
  const hasDescription =
    !!pageContent?.content && pageContent.content.trim() !== '' && pageContent.content !== '<p></p>'

  return (
    <PageLayout>
      <PageHeader
        pageTitle="Prints"
        pageSubtitle="Museum-grade prints of selected works, in open and limited editions."
      />

      <div className={styles.intro}>
        <PrintsBanner
          imageUrl={pageContent?.bannerImageUrl ?? null}
          alt={pageContent?.title || 'Fine Art Prints'}
        />
        <div className={styles.description}>
          <Text as="h2" font="serif" size="3xl" className={styles.descriptionTitle}>
            Fine Art Prints
          </Text>
          {hasDescription && <RichText content={pageContent!.content} />}
        </div>
      </div>

      {/* Names what the grid is: a chosen set, not an inventory. Sits directly
          on the grid so it reads as its heading rather than page furniture. */}
      <Text as="h2" font="serif" size="xl" className={styles.selectionTitle}>
        Gallery Selection
      </Text>

      {selection.length === 0 ? (
        /* A legitimate state — nothing selected yet, or everything selected has
           gone quiet. The page keeps its banner and copy and says so, rather
           than showing a blank grid that reads as broken. */
        <Text as="p" className={styles.selectionEmpty}>
          New prints are being selected. In the meantime, every artist&rsquo;s available work is on{' '}
          <a href="/artists">their own page</a>.
        </Text>
      ) : (
        <ArtworkGrid artworks={selection} />
      )}
    </PageLayout>
  )
}
```

- [ ] **Step 5: Add the two new styles to `src/components/prints/prints.module.scss`**

```scss
// Heading for the curated grid. Sits on the grid, not above the intro — it
// names what follows rather than retitling the page.
.selectionTitle {
  margin-bottom: var(--space-6);
  text-align: center;
  color: var(--color-text-primary);
}

.selectionEmpty {
  margin: var(--space-10) 0;
  text-align: center;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 6: Delete the catalogue UI**

```bash
git rm src/components/prints/PrintsBrowser.tsx src/components/prints/PrintsToolbar.tsx
```

Then remove the now-unused `PRINTS_PAGE_SIZE`, `EditionFilter`, `PrintArtistOption`
and `displayArtist` exports from `src/components/prints/types.ts` **only if**
`grep -rn "PRINTS_PAGE_SIZE\|EditionFilter\|displayArtist" src e2e` shows no
remaining consumers. Task 5 uses several of them — if it has not run yet, leave
them and note it.

- [ ] **Step 7: Re-point `e2e/prints-pagination.spec.ts`**

That spec asserts the public page paginates, which is no longer true. Replace its
two tests with one that asserts the action still pages correctly for the picker:

```typescript
import { test, expect } from '@playwright/test'

import { getPrintsCatalogPage } from '@/app/prints/actions'

/**
 * The catalogue query outlived the catalogue page: it now feeds the admin
 * picker (see gallery-selection). Paging still has to be right, because the
 * picker pages through it.
 */
test('the catalogue action pages and reports a total', async () => {
  const { items, totalCount } = await getPrintsCatalogPage({ page: 1 })
  expect(totalCount).toBeGreaterThanOrEqual(items.length)
  expect(items.length).toBeLessThanOrEqual(24)
})

test('the edition filter narrows the action server-side', async () => {
  const all = await getPrintsCatalogPage({ page: 1 })
  const limited = await getPrintsCatalogPage({ page: 1, edition: 'limited' })
  expect(limited.totalCount).toBeLessThanOrEqual(all.totalCount)
  expect(limited.items.every((i) => i.editionType === 'limited')).toBe(true)
})
```

- [ ] **Step 8: Run the tests**

Run: `npx playwright test "(gallery-selection|prints-|artwork-)" --config=playwright.config.ts`
Expected: all pass. `artwork-sale-card` and `artwork-grid-alignment` must stay
green — `ArtworkGrid` was not touched.

- [ ] **Step 9: Verify a production build** (this changes the import graph)

Stop `pnpm dev` first, then: `pnpm build`
Expected: build succeeds. `PrintsBrowser` was the only `'use client'` consumer of
the catalogue action; removing it must not break the server/client boundary.

- [ ] **Step 10: Typecheck, lint, format, commit** (owner confirms first)

```bash
npx tsc --noEmit && npx eslint . && npx prettier --write src/app/prints src/components/prints e2e/prints-pagination.spec.ts
git add -A src/app/prints src/components/prints e2e
git commit -m "AR-140: /prints is the gallery's selection, not the catalogue"
```

---

## Task 4: Admin screen — the ordered selection list

**Files:**

- Create: `src/app/admin/content/gallery-selection/page.tsx`
- Create: `src/components/admin/GallerySelection/index.tsx`
- Create: `src/components/admin/GallerySelection/SelectionList.tsx`
- Create: `src/components/admin/GallerySelection/GallerySelection.module.scss`
- Modify: `src/components/admin/dashboard/ContentManagement.tsx` (add the link)
- Test: `e2e/gallery-selection-admin.spec.ts`

**Interfaces:**

- Consumes: `AdminSelectionRow`, `SelectionStatus` (Task 1); the four routes (Task 2).
- Produces: `<GallerySelection />` default screen; `<SelectionList rows onReorder onRemove />` where `onReorder(ids: string[])` and `onRemove(selectionId: string)`.

- [ ] **Step 1: Write the failing test**

Create `e2e/gallery-selection-admin.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The curator's screen. Its job is to make a wrong selection visible: an entry
 * that has stopped selling stays in the list, greyed, with the reason — the
 * decision was to flag, never to silently un-curate.
 */
test('a sold-out entry stays listed, greyed, with its reason', async ({ page }) => {
  const fx = await setupLimitedFixture(2)
  const title = `E2E Admin SoldOut ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })
    await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })
    await prisma.editionNumber.updateMany({
      where: { variantId: fx.variantId },
      data: { state: 'sold' },
    })

    await page.goto('/admin/content/gallery-selection')
    const row = page.locator('[data-selection-row]', { hasText: title })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Sold out')
    await expect(row, 'sold out is shown, not hidden').toContainText('shown on the page')
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})

test('removing an entry drops it from the list and from /prints', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  const title = `E2E Admin Remove ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })
    await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })

    await page.goto('/admin/content/gallery-selection')
    await page
      .locator('[data-selection-row]', { hasText: title })
      .getByRole('button', { name: 'Remove' })
      .click()
    await expect(page.locator('[data-selection-row]', { hasText: title })).toHaveCount(0)

    await page.goto('/prints')
    await expect(page.getByText(title)).toHaveCount(0)
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx playwright test gallery-selection-admin --config=playwright.config.ts`
Expected: FAIL — the route 404s.

- [ ] **Step 3: Create the route shell `src/app/admin/content/gallery-selection/page.tsx`**

Copy the guard shape from `src/app/admin/content/page.tsx`, tightened to super
admin only:

```typescript
'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { GallerySelection } from '@/components/admin/GallerySelection'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { LoadingBar } from '@/components/ui/LoadingBar'

const GallerySelectionPage = () => {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Super admin only — this is the gallery's own editorial voice. The API
  // enforces it too; this is just so the screen never flashes into view.
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    else if (status === 'authenticated' && session?.user?.userType !== 'superAdmin') router.push('/')
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className={dashboardStyles.page}>
        <LoadingBar />
      </div>
    )
  }
  if (status === 'unauthenticated' || session?.user?.userType !== 'superAdmin') {
    return <div className={dashboardStyles.page}>Not authorized</div>
  }

  return (
    <DashboardLayout backLink="/admin/content" backLabel="← Back to Content">
      <h1 className={dashboardStyles.pageTitle}>Gallery Selection</h1>
      <GallerySelection />
    </DashboardLayout>
  )
}

export default GallerySelectionPage
```

- [ ] **Step 4: Create `src/components/admin/GallerySelection/SelectionList.tsx`**

Mirror `SortableSlideItem` in `src/app/admin/content/landing/page.tsx` exactly —
same sensors, same `CSS.Transform.toString(transform)` style, same drag handle.

```typescript
'use client'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import type { AdminSelectionRow, SelectionStatus } from '@/lib/queries/getGallerySelection'

import styles from './GallerySelection.module.scss'

/**
 * What the curator is told about each entry. Sold out is NOT a problem state — it
 * stays on the page as proof the editions move — so it reads differently from a
 * work withdrawn from sale entirely.
 */
const REASON: Record<SelectionStatus, string | null> = {
  live: null,
  'sold-out': 'Sold out · shown on the page',
  'not-for-sale': 'Not for sale · hidden from the page',
}

function SortableRow({ row, onRemove }: { row: AdminSelectionRow; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.selectionId,
  })
  const reason = REASON[row.status]

  return (
    <div
      ref={setNodeRef}
      data-selection-row
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={
        row.status === 'not-for-sale' ? `${styles.row} ${styles.rowHidden}` : styles.row
      }
    >
      <div className={styles.dragHandle} {...attributes} {...listeners}>
        <span className={styles.dragIcon}>⠿</span>
      </div>
      {row.artwork.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.artwork.imageUrl} alt="" className={styles.thumb} />
      )}
      <div className={styles.rowInfo}>
        <Text font="dashboard" as="h3">
          {row.artwork.title || row.artwork.name}
        </Text>
        <Text font="dashboard" as="p" className={styles.rowMeta}>
          {row.artistName}
          {row.artwork.sale ? ` · ${row.artwork.sale.editionType === 'limited' ? 'Limited' : 'Open'}` : ''}
        </Text>
        {reason && (
          <Text font="dashboard" as="p" className={styles.rowReason}>
            {reason}
          </Text>
        )}
      </div>
      <Button font="dashboard" variant="secondary" label="Remove" onClick={() => onRemove(row.selectionId)} />
    </div>
  )
}

type Props = {
  rows: AdminSelectionRow[]
  onReorder: (ids: string[]) => void
  onRemove: (selectionId: string) => void
}

export const SelectionList = ({ rows, onReorder, onRemove }: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rows.findIndex((r) => r.selectionId === active.id)
    const newIndex = rows.findIndex((r) => r.selectionId === over.id)
    onReorder(arrayMove(rows, oldIndex, newIndex).map((r) => r.selectionId))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map((r) => r.selectionId)} strategy={verticalListSortingStrategy}>
        {rows.map((row) => (
          <SortableRow key={row.selectionId} row={row} onRemove={onRemove} />
        ))}
      </SortableContext>
    </DndContext>
  )
}
```

- [ ] **Step 5: Create `src/components/admin/GallerySelection/index.tsx`**

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Text } from '@/components/ui/Typography'
import type { AdminSelectionRow } from '@/lib/queries/getGallerySelection'

import { SelectionList } from './SelectionList'
import styles from './GallerySelection.module.scss'

export const GallerySelection = () => {
  const [rows, setRows] = useState<AdminSelectionRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/selected-prints')
    setRows(res.ok ? await res.json() : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleReorder = async (ids: string[]) => {
    // Optimistic: the drag already moved it on screen, and snapping back on a
    // slow round-trip reads as a failed drag.
    setRows((prev) => ids.map((id) => prev.find((r) => r.selectionId === id)!).filter(Boolean))
    await fetch('/api/selected-prints/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    void load()
  }

  const handleRemove = async (selectionId: string) => {
    await fetch(`/api/selected-prints/${selectionId}`, { method: 'DELETE' })
    void load()
  }

  // Per-artist tally. Surfaced, never enforced: the owner asked for no cap, but
  // "four of these are by one artist" should not need counting by eye.
  const perArtist = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.artistName] = (acc[r.artistName] ?? 0) + 1
    return acc
  }, {})
  // Counted apart: a sold-out entry is a signal worth keeping on the page, a
  // withdrawn one is a gap to fill.
  const soldOutCount = rows.filter((r) => r.status === 'sold-out').length
  const withdrawnCount = rows.filter((r) => r.status === 'not-for-sale').length

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Text font="dashboard" as="p" className={styles.tally}>
          {rows.length} works · {Object.keys(perArtist).length} artists
          {soldOutCount > 0 ? ` · ${soldOutCount} sold out` : ''}
          {withdrawnCount > 0 ? ` · ${withdrawnCount} hidden` : ''}
        </Text>
        <Text font="dashboard" as="p" className={styles.tallyDetail}>
          {Object.entries(perArtist)
            .map(([name, n]) => `${name} ${n}`)
            .join(' · ')}
        </Text>
      </div>

      {loading ? null : rows.length === 0 ? (
        <EmptyState message="Nothing selected yet — /prints is showing its empty state." />
      ) : (
        <SelectionList rows={rows} onReorder={handleReorder} onRemove={handleRemove} />
      )}

      {/* Task 5 replaces this with the picker modal. */}
      <Button font="dashboard" variant="primary" label="Add artworks" onClick={() => {}} />
    </div>
  )
}
```

- [ ] **Step 6: Create `GallerySelection.module.scss`**

```scss
.screen {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tally {
  font-weight: 600;
  color: var(--color-text-primary);
}

.tallyDetail {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-surface-default);
}

// An entry that is no longer on the page. Dimmed, not removed — the curator
// decides what replaces it.
.rowHidden {
  opacity: 0.55;
}

.dragHandle {
  cursor: grab;
  color: var(--color-text-secondary);
}

.dragIcon {
  font-size: var(--text-lg);
}

.thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.rowInfo {
  flex: 1;
  min-width: 0;
}

.rowMeta {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}

.rowReason {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

Check `src/styles` for the real token names before using `--radius-md`,
`--radius-sm` and `--color-surface-default`; substitute the project's actual
tokens if they differ. Never add a fallback value.

- [ ] **Step 7: Link it from the Content hub**

In `src/components/admin/dashboard/ContentManagement.tsx`, add an entry beside
the existing "Landing" one pointing at `/admin/content/gallery-selection`,
described as "Choose and order the prints shown on /prints." Match the
surrounding markup exactly.

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `npx playwright test gallery-selection-admin --config=playwright.config.ts`
Expected: 2 passed.

- [ ] **Step 9: Typecheck, lint, format, commit** (owner confirms first)

```bash
npx tsc --noEmit && npx eslint src/components/admin/GallerySelection src/app/admin/content/gallery-selection && npx prettier --write "src/components/admin/GallerySelection/**" "src/app/admin/content/gallery-selection/**"
git add src/app/admin/content/gallery-selection src/components/admin/GallerySelection src/components/admin/dashboard/ContentManagement.tsx e2e/gallery-selection-admin.spec.ts
git commit -m "AR-140: curator's screen — order the selection, see what went quiet"
```

---

## Task 5: The picker

**Files:**

- Create: `src/components/admin/GallerySelection/AddArtworksModal.tsx`
- Modify: `src/components/admin/GallerySelection/index.tsx` (wire the button)
- Modify: `src/components/admin/GallerySelection/GallerySelection.module.scss`
- Modify: `src/app/prints/actions.ts`
- Test: `e2e/gallery-selection-admin.spec.ts` (append)

**Interfaces:**

- Consumes: `getPrintsCatalogPage`, `getPrintArtistOptions` from `@/app/prints/actions`; `POST /api/selected-prints`.
- Produces: `<AddArtworksModal onClose onAdded excludeIds />`.

- [ ] **Step 1: Extend the two actions in `src/app/prints/actions.ts`**

`getPrintsCatalogPage` gains two arguments. Add to `GetPrintsCatalogPageArgs`:

```typescript
  /** Case-insensitive match on artwork title or internal name. */
  search?: string
  /** Already-selected artworks, excluded so the picker never offers a duplicate. */
  excludeIds?: string[]
```

and thread them into `buildPrintsWhere`:

```typescript
const buildPrintsWhere = (
  artistId: string,
  edition: EditionFilter,
  search = '',
  excludeIds: string[] = [],
): Prisma.ArtworkWhereInput => ({
  ...purchasableArtworkWhere(),
  user: { published: true },
  ...(artistId ? { userId: artistId } : {}),
  ...(edition === 'open' || edition === 'limited' ? { editionType: edition } : {}),
  ...(search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}),
  ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
})
```

Note the collision: `purchasableArtworkWhere()` already returns an `OR`. Spreading
a second `OR` overwrites it and would widen the query to unsellable work. Wrap
both instead:

```typescript
const base = purchasableArtworkWhere()
const where: Prisma.ArtworkWhereInput = {
  AND: [
    base,
    ...(search
      ? [
          {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        ]
      : []),
  ],
  user: { published: true },
  ...(artistId ? { userId: artistId } : {}),
  ...(edition === 'open' || edition === 'limited' ? { editionType: edition } : {}),
  ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
}
return where
```

`getPrintArtistOptions` gains a count. Change its return to
`{ value, label, count }` by grouping instead of `distinct`:

```typescript
export async function getPrintArtistOptions(): Promise<PrintArtistOption[]> {
  const grouped = await prisma.artwork.groupBy({
    by: ['userId'],
    where: buildPrintsWhere('', ''),
    _count: { _all: true },
  })
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, name: true, lastName: true },
  })
  return grouped
    .map((g) => {
      const u = users.find((x) => x.id === g.userId)
      const label = [u?.name, u?.lastName].filter(Boolean).join(' ').trim()
      return { value: g.userId, label, count: g._count._all }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}
```

Add `count: number` to `PrintArtistOption` in `src/components/prints/types.ts`.
The per-work `author` override is dropped from the label here — the picker groups
by the account that owns the work, and an override would make two rows for one
artist.

- [ ] **Step 2: Write the failing test**

Append to `e2e/gallery-selection-admin.spec.ts`:

```typescript
test('the picker adds a work by artist, and it lands on /prints', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  const title = `E2E Picker ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })

    await page.goto('/admin/content/gallery-selection')
    await page.getByRole('button', { name: 'Add artworks' }).click()

    // By artist: filter the artist list, drill in, tick, add.
    await page.getByPlaceholder('Search artists').fill('John')
    await page.getByRole('button', { name: /John Doe/ }).click()
    await page.locator('[data-picker-row]', { hasText: title }).getByRole('checkbox').check()
    await page.getByRole('button', { name: /^Add 1$/ }).click()

    await expect(page.locator('[data-selection-row]', { hasText: title })).toBeVisible()

    await page.goto('/prints')
    await expect(page.getByText(title)).toBeVisible()
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})

test('an already-selected work is not offered again', async ({ page }) => {
  const fx = await setupLimitedFixture(3)
  const title = `E2E Picker Dup ${fx.slug}`
  try {
    await prisma.artwork.update({
      where: { id: fx.artworkId },
      data: { printPriceCents: null, title },
    })
    await prisma.selectedPrint.create({ data: { artworkId: fx.artworkId, order: 0 } })

    await page.goto('/admin/content/gallery-selection')
    await page.getByRole('button', { name: 'Add artworks' }).click()
    await page.getByRole('radio', { name: 'By name' }).check()
    await page.getByPlaceholder('Search by title').fill(title)

    await expect(page.locator('[data-picker-row]', { hasText: title })).toHaveCount(0)
  } finally {
    await prisma.selectedPrint.deleteMany({ where: { artworkId: fx.artworkId } })
    await teardownLimitedFixture(fx)
  }
})
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx playwright test gallery-selection-admin -g "picker" --config=playwright.config.ts`
Expected: FAIL — no "Add artworks" dialog opens.

- [ ] **Step 4: Implement `AddArtworksModal.tsx`**

```typescript
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getPrintArtistOptions, getPrintsCatalogPage } from '@/app/prints/actions'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { Text } from '@/components/ui/Typography'
import type { PrintArtistOption, PrintArtwork } from '@/components/prints/types'

import styles from './GallerySelection.module.scss'

type Mode = 'artist' | 'name'

type Props = {
  /** Already selected — never offered again. */
  excludeIds: string[]
  onClose: () => void
  onAdded: () => void
}

/**
 * Two ways in, never both at once, because they answer different questions:
 * "what does Jane have?" and "where is that piece called Puerta?".
 *
 * The searches are deliberately not uniform. The artist list scales with
 * artists, and one artist's output is bounded — both are fetched once and
 * filtered in the browser, so typing is instant. Searching titles across every
 * artist is unbounded, so that one goes to the server.
 */
export const AddArtworksModal = ({ excludeIds, onClose, onAdded }: Props) => {
  const [mode, setMode] = useState<Mode>('artist')
  const [query, setQuery] = useState('')
  const [artists, setArtists] = useState<PrintArtistOption[]>([])
  const [artistId, setArtistId] = useState<string | null>(null)
  const [artistWorks, setArtistWorks] = useState<PrintArtwork[]>([])
  const [nameResults, setNameResults] = useState<PrintArtwork[]>([])
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getPrintArtistOptions().then(setArtists)
  }, [])

  // Drill-in: one artist's sellable prints, fetched once and filtered locally.
  useEffect(() => {
    if (!artistId) return
    setQuery('')
    void getPrintsCatalogPage({ page: 1, artistId, excludeIds }).then((r) => setArtistWorks(r.items))
  }, [artistId, excludeIds])

  // Title search across everyone — the only unbounded case, so debounced.
  useEffect(() => {
    if (mode !== 'name') return
    if (query.trim() === '') {
      setNameResults([])
      return
    }
    const t = setTimeout(() => {
      void getPrintsCatalogPage({ page: 1, search: query.trim(), excludeIds }).then((r) =>
        setNameResults(r.items),
      )
    }, 250)
    return () => clearTimeout(t)
  }, [mode, query, excludeIds])

  const visibleArtists = useMemo(
    () => artists.filter((a) => a.label.toLowerCase().includes(query.trim().toLowerCase())),
    [artists, query],
  )
  const visibleArtistWorks = useMemo(
    () =>
      artistWorks.filter((w) =>
        (w.title || w.name || '').toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [artistWorks, query],
  )

  const toggle = useCallback((id: string) => {
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleAdd = async () => {
    setSaving(true)
    const res = await fetch('/api/selected-prints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artworkIds: [...ticked] }),
    })
    setSaving(false)
    if (res.ok) {
      onAdded()
      onClose()
    }
  }

  const row = (w: PrintArtwork) => (
    <div key={w.id} data-picker-row className={styles.pickerRow}>
      <Checkbox checked={ticked.has(w.id)} onChange={() => toggle(w.id)} />
      {w.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={w.imageUrl} alt="" className={styles.thumb} />
      )}
      <Text font="dashboard" as="span" className={styles.pickerTitle}>
        {w.title || w.name}
      </Text>
      <Text font="dashboard" as="span" className={styles.rowMeta}>
        {w.editionType === 'limited' ? 'Limited' : 'Open'}
      </Text>
    </div>
  )

  return (
    <Modal onClose={onClose} titleId="add-artworks-title" maxWidth="720px">
      <h2 id="add-artworks-title" className={styles.pickerTitleHeading}>
        Add artworks
      </h2>

      <RadioGroup
        name="picker-mode"
        value={mode}
        onChange={(v) => {
          setMode(v as Mode)
          setQuery('')
          setArtistId(null)
        }}
        options={[
          { value: 'artist', label: 'By artist' },
          { value: 'name', label: 'By name' },
        ]}
      />

      {mode === 'artist' && artistId === null && (
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists"
          />
          {visibleArtists.map((a) => (
            <Button
              key={a.value}
              font="dashboard"
              variant="secondary"
              className={styles.pickerArtist}
              label={`${a.label} — ${a.count} prints`}
              onClick={() => setArtistId(a.value)}
            />
          ))}
        </>
      )}

      {mode === 'artist' && artistId !== null && (
        <>
          <Button
            font="dashboard"
            variant="ghost"
            label="‹ All artists"
            onClick={() => {
              setArtistId(null)
              setQuery('')
            }}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${artists.find((a) => a.value === artistId)?.label ?? ''}'s prints`}
          />
          {visibleArtistWorks.length === 0 ? (
            <EmptyState message="No prints match." />
          ) : (
            visibleArtistWorks.map(row)
          )}
        </>
      )}

      {mode === 'name' && (
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title"
          />
          {query.trim() === '' ? (
            <Text font="dashboard" as="p" className={styles.rowMeta}>
              Type a title to search every artist.
            </Text>
          ) : nameResults.length === 0 ? (
            <EmptyState message="No prints match." />
          ) : (
            nameResults.map(row)
          )}
        </>
      )}

      <div className={styles.pickerFooter}>
        <Text font="dashboard" as="span">
          {ticked.size} selected
        </Text>
        <Button font="dashboard" variant="secondary" label="Cancel" onClick={onClose} />
        <Button
          font="dashboard"
          variant="primary"
          label={`Add ${ticked.size}`}
          disabled={ticked.size === 0 || saving}
          onClick={handleAdd}
        />
      </div>
    </Modal>
  )
}
```

Verified against the real components: `Checkbox` is a NAMED export taking
`{ checked, onChange, label?, disabled? }`; `Input` takes `{ value, onChange,
placeholder }`; `RadioGroup` takes `{ name, options, value, onChange }` and its
`onChange` receives the VALUE, not an event. The `placeholder` strings above are
what the tests query by — change them in both places or not at all.

- [ ] **Step 5: Wire it into `index.tsx`**

Replace the placeholder button:

```typescript
const [pickerOpen, setPickerOpen] = useState(false)
```

```typescript
      <Button
        font="dashboard"
        variant="primary"
        label="Add artworks"
        onClick={() => setPickerOpen(true)}
      />
      {pickerOpen && (
        <AddArtworksModal
          excludeIds={rows.map((r) => r.artwork.id)}
          onClose={() => setPickerOpen(false)}
          onAdded={load}
        />
      )}
```

- [ ] **Step 6: Add the picker styles**

```scss
.pickerRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-default);
}

.pickerTitle {
  flex: 1;
  min-width: 0;
  color: var(--color-text-primary);
}

.pickerTitleHeading {
  margin-bottom: var(--space-4);
}

.pickerArtist {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.pickerFooter {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-5);
}
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx playwright test gallery-selection --config=playwright.config.ts`
Expected: all gallery-selection specs pass, both files.

- [ ] **Step 8: Full regression, then production build**

```bash
npx playwright test --config=playwright.config.ts
```

Expected: the whole suite green. Then stop `pnpm dev` and run `pnpm build`.

- [ ] **Step 9: Typecheck, lint, format, commit** (owner confirms first)

```bash
npx tsc --noEmit && npx eslint . && npx prettier --write "src/**" "e2e/**"
git add -A src e2e
git commit -m "AR-140: the picker — find by artist or by name, add in one batch"
```

---

## Rollout

The selection starts empty, and there is no catalogue fallback, so `/prints`
shows its empty state from the moment this deploys. **Populate the selection
before shipping**, or the shop page is empty in production.

Order of operations for the deploy: owner applies the schema change to prod →
deploy → owner opens `/admin/content/gallery-selection` and builds the
selection. The empty state exists so the window between the last two steps is
not a broken page, not so it can be left indefinitely.
