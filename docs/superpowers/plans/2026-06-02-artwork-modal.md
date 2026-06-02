# Artwork Page → Real Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the artwork-detail "fake modal route" with a real full-screen modal overlaid on the still-mounted exhibition scene, so dismissing it never reloads the 3D view.

**Architecture:** Extract the artwork-detail body into one shared `ArtworkDetailBody` used by both the standalone `/artworks/[slug]` route and a new `ArtworkModal`. The modal opens instantly from Redux data, backfills the rest via the existing `by-slug` API, reuses the scene's already-cached image, and is controlled by a Redux flag. The fake-modal route mode, camera-state save/restore, and `internal-nav` plumbing (artwork-detail half only) are deleted.

**Tech Stack:** Next.js (App Router), React, Redux Toolkit, TypeScript, SCSS modules.

**Testing note:** This repo is Playwright-e2e-only with no unit-test runner, and we do not add WebGL-scene-mounting e2e. So each task closes with **`pnpm typecheck` + `pnpm lint` + a manual check + commit** — that is the verification discipline that fits here. The spec marks automated e2e as skipped.

**Spec:** `docs/superpowers/specs/2026-06-02-artwork-modal-design.md`

---

## File structure

- **Create** `src/hooks/useIsMobile.ts` — shared mobile-breakpoint hook (extracted from `ExhibitionViewPage`).
- **Create** `src/components/artwork/detail/ArtworkDetailBody.tsx` — shared body (metadata + image + Inquire/Share/Order Print + `InquireSidebar`). Exports `Artwork` and `Artist` types.
- **Create** `src/components/exhibitions/view/ArtworkModal/ArtworkModal.tsx` — full-screen overlay + X, fetch/merge, Esc/scroll-lock, mobile self-hide.
- **Create** `src/components/exhibitions/view/ArtworkModal/ArtworkModal.module.scss` — overlay + close + body grid.
- **Create** `src/components/exhibitions/view/ArtworkModal/mapReduxArtwork.ts` — Redux `TArtwork` → body `Artwork`/`Artist` shapes.
- **Modify** `src/types/dashboard.ts` — add `isArtworkModalOpen`.
- **Modify** `src/factories/dashboardFactory.ts` — add `isArtworkModalOpen: false`.
- **Modify** `src/redux/slices/dashboardSlice.ts` — add `openArtworkModal` / `closeArtworkModal`.
- **Modify** `src/components/artwork/detail/index.tsx` — simplify to `PageLayout` + `ArtworkDetailBody`; delete `isInternal` mode + artwork-detail `internal-nav` usage.
- **Modify** `src/components/artwork/detail/ArtworkDetail.module.scss` — delete dead classes.
- **Modify** `src/components/exhibitions/view/index.tsx` — import `useIsMobile`; render `<ArtworkModal/>` when `isArtworkModalOpen`.
- **Modify** `src/components/editview/ArtworkPanel/ArtworkPanel.tsx` — View Details now closes sidebar + opens modal; remove camera-state/`internal-nav` writes + `getCameraState` import.
- **Modify** `src/components/scene/controls/MainCamera/MainCamera.tsx` — remove camera-state restore + `getCameraState`/`currentCameraState`.
- **Modify** `src/app/api/artworks/by-slug/[slug]/route.ts` — add `originalWidth` + `originalHeight`.

**Do NOT touch** `EnterExhibitionButton.tsx` or the `internal-nav` read in `ExhibitionViewPage` (lines ~47-50) — that key is also used by an unrelated exhibition-entry flow. Only the artwork-detail half of `internal-nav` is removed.

---

## Task 1: Redux flag for the modal

**Files:**
- Modify: `src/types/dashboard.ts`
- Modify: `src/factories/dashboardFactory.ts`
- Modify: `src/redux/slices/dashboardSlice.ts`

- [ ] **Step 1: Add the flag to the state type**

In `src/types/dashboard.ts`, add `isArtworkModalOpen` right after `isArtworkPanelOpen`:

```ts
  isArtworkPanelOpen: boolean
  isArtworkModalOpen: boolean
```

- [ ] **Step 2: Default it in the factory**

In `src/factories/dashboardFactory.ts`, add the field after `isArtworkPanelOpen: false,`:

```ts
  isArtworkPanelOpen: false,
  isArtworkModalOpen: false,
```

- [ ] **Step 3: Add reducers + exports**

In `src/redux/slices/dashboardSlice.ts`, add these two reducers after `hideArtworkPanel`:

```ts
    openArtworkModal: (state: TDashboardState) => {
      state.isArtworkModalOpen = true
    },
    closeArtworkModal: (state: TDashboardState) => {
      state.isArtworkModalOpen = false
    },
```

And add `openArtworkModal, closeArtworkModal,` to the destructured `export const { … } = dashboardSlice.actions` block (next to `showArtworkPanel, hideArtworkPanel,`).

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/dashboard.ts src/factories/dashboardFactory.ts src/redux/slices/dashboardSlice.ts
git commit -m "AR-124: add isArtworkModalOpen redux flag + open/close actions"
```

---

## Task 2: Extract `useIsMobile` to a shared hook

`useIsMobile` is currently defined inline in `ExhibitionViewPage` (`src/components/exhibitions/view/index.tsx:465`). The modal needs the same 1024px threshold, so extract it.

**Files:**
- Create: `src/hooks/useIsMobile.ts`
- Modify: `src/components/exhibitions/view/index.tsx`

- [ ] **Step 1: Create the shared hook**

Create `src/hooks/useIsMobile.ts`:

```ts
'use client'

import { useEffect, useState } from 'react'

/** True when the viewport is narrower than `breakpoint` (default 1024px). SSR-safe. */
export const useIsMobile = (breakpoint = 1024): boolean => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}
```

> Note: confirm this matches the existing inline implementation's initial-state and resize behavior at `src/components/exhibitions/view/index.tsx:465-476`. If the existing one differs (e.g. defaults `isMobile` to `false` on first render), keep this file's behavior identical to the existing one to avoid a hydration/behavior change — copy the existing body verbatim into this file.

- [ ] **Step 2: Use it in ExhibitionViewPage**

In `src/components/exhibitions/view/index.tsx`:
1. Delete the inline `const useIsMobile = (breakpoint = 1024) => { … }` definition (around line 465-476).
2. Add the import near the other hook imports:

```ts
import { useIsMobile } from '@/hooks/useIsMobile'
```

The existing call site `const isMobile = useIsMobile()` (≈ line 485) stays unchanged.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0. Then `pnpm dev`, open `/exhibitions/john-doe/landscapes/visit` on desktop width and confirm it still loads the 3D view (not the mobile view); shrink < 1024px and confirm it swaps to the mobile view as before.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useIsMobile.ts src/components/exhibitions/view/index.tsx
git commit -m "AR-124: extract useIsMobile into a shared hook"
```

---

## Task 3: Add image dimensions to the by-slug API

**Files:**
- Modify: `src/app/api/artworks/by-slug/[slug]/route.ts`

- [ ] **Step 1: Include the fields in the response**

In `src/app/api/artworks/by-slug/[slug]/route.ts`, add `originalWidth` and `originalHeight` to the `data.artwork` object (after `imageUrl: artwork.imageUrl,`):

```ts
            imageUrl: artwork.imageUrl,
            originalWidth: artwork.originalWidth,
            originalHeight: artwork.originalHeight,
            printEnabled: artwork.printEnabled,
            printPriceCents: artwork.printPriceCents,
```

(`prisma.artwork.findUnique` with no `select` returns all scalar columns, so `originalWidth`/`originalHeight` are already on `artwork` — we are only adding them to the shaped response. If a `select` is added later, include them there too.)

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0. Then `pnpm dev` and hit `http://localhost:3001/api/artworks/by-slug/<a-real-slug>` — confirm the JSON now contains `originalWidth` and `originalHeight`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/artworks/by-slug/[slug]/route.ts"
git commit -m "AR-124: return originalWidth/Height from by-slug artwork API"
```

---

## Task 4: Create the shared `ArtworkDetailBody`

Extract the body that is currently duplicated in both branches of `src/components/artwork/detail/index.tsx`. Switch the image to a raw `<img>` (cache hit from the scene's texture) and compute the Share URL from the slug.

**Files:**
- Create: `src/components/artwork/detail/ArtworkDetailBody.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/artwork/detail/ArtworkDetailBody.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { Share } from '@/components/ui/Share'
import { isRichTextEmpty } from '@/lib/textUtils'

import styles from './ArtworkDetail.module.scss'

export type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
}

export type Artwork = {
  id: string
  slug: string
  name: string
  title?: string | null
  author?: string | null
  year?: string | null
  technique?: string | null
  dimensions?: string | null
  description?: string | null
  imageUrl?: string | null
  originalWidth?: number | null
  originalHeight?: number | null
  printEnabled?: boolean | null
  printPriceCents?: number | null
}

const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 800

interface ArtworkDetailBodyProps {
  artwork: Artwork
  artist: Artist
}

/**
 * The artwork-detail body, shared by the standalone /artworks/[slug] page and the
 * in-exhibition ArtworkModal. Renders only the metadata + image + InquireSidebar;
 * the surrounding chrome (page header/footer, or modal overlay/X) is the caller's job.
 */
export const ArtworkDetailBody = ({ artwork, artist }: ArtworkDetailBodyProps) => {
  const router = useRouter()
  const [isInquireOpen, setIsInquireOpen] = useState(false)

  const displayTitle = artwork.title || artwork.name || ''
  const displayAuthor = artwork.author || `${artist.name} ${artist.lastName}`.trim()
  const imgWidth = artwork.originalWidth ?? FALLBACK_WIDTH
  const imgHeight = artwork.originalHeight ?? FALLBACK_HEIGHT

  // Canonical artwork URL — identical to the standalone page's URL, built from the slug
  // so it is correct even when opened as a modal over the exhibition route.
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/artworks/${artwork.slug}` : ''

  return (
    <>
      <div className={styles.metadata}>
        {displayAuthor && (
          <Text as="h1" size="2xl" className={styles.artistName}>
            {displayAuthor}
          </Text>
        )}
        {displayTitle && (
          <div className={styles.title}>
            <Text as="span" size="xl" font="serif" className={styles.titleText}>
              {displayTitle}
            </Text>
            {artwork.year && (
              <Text as="span" size="xl" font="serif" className={styles.year}>
                , {artwork.year}
              </Text>
            )}
          </div>
        )}
        {artwork.technique && (
          <RichText content={artwork.technique} variant="compact" className={styles.technique} />
        )}
        {artwork.dimensions && (
          <Text as="p" size="sm" className={styles.dimensions}>
            {artwork.dimensions}
          </Text>
        )}
        {!isRichTextEmpty(artwork.description) && (
          <RichText content={artwork.description!} variant="compact" className={styles.description} />
        )}
        <Button
          variant="secondary"
          label="Inquire"
          icon="arrowRight"
          size="bigSquared"
          onClick={() => setIsInquireOpen(true)}
          className={styles.inquireButton}
        />
        {artwork.printEnabled && artwork.printPriceCents ? (
          <Button
            variant="primary"
            label="Order Print"
            icon="arrowRight"
            size="bigSquared"
            onClick={() => router.push(`/artworks/${artwork.slug}/print`)}
            className={styles.inquireButton}
          />
        ) : null}
        <Share title={displayTitle || 'Artwork'} url={shareUrl} className={styles.share} />
      </div>

      <div className={styles.imageContainer}>
        {artwork.imageUrl && (
          // Raw <img> (not next/image): reuses the image the 3D scene already cached, and
          // sidesteps the known next/image + R2 prod issue. crossOrigin matches THREE's
          // texture request so the same browser-cache entry is reused.
          <img
            src={artwork.imageUrl}
            alt={displayTitle || 'Artwork'}
            width={imgWidth}
            height={imgHeight}
            className={styles.image}
            crossOrigin="anonymous"
            decoding="async"
          />
        )}
      </div>

      <InquireSidebar
        isOpen={isInquireOpen}
        onClose={() => setIsInquireOpen(false)}
        artwork={{
          slug: artwork.slug,
          title: displayTitle || '',
          year: artwork.year ? parseInt(artwork.year) : undefined,
          artistName: displayAuthor || '',
          imageUrl: artwork.imageUrl || '',
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0. (Component is not yet rendered anywhere — this just confirms it compiles and matches the `InquireSidebar`/`Share` prop types.)

- [ ] **Step 3: Commit**

```bash
git add src/components/artwork/detail/ArtworkDetailBody.tsx
git commit -m "AR-124: extract shared ArtworkDetailBody (raw img, slug-based share url)"
```

---

## Task 5: Simplify the standalone route + drop dead styles

**Files:**
- Modify: `src/components/artwork/detail/index.tsx`
- Modify: `src/components/artwork/detail/ArtworkDetail.module.scss`

- [ ] **Step 1: Replace `index.tsx` with the slim standalone version**

Replace the entire contents of `src/components/artwork/detail/index.tsx` with:

```tsx
import { PageLayout } from '@/components/ui/PageLayout'

import { ArtworkDetailBody, type Artwork, type Artist } from './ArtworkDetailBody'
import styles from './ArtworkDetail.module.scss'

interface ArtworkDetailPageProps {
  artwork: Artwork
  artist: Artist
}

export const ArtworkDetailPage = ({ artwork, artist }: ArtworkDetailPageProps) => {
  return (
    <PageLayout>
      <div className={styles.standaloneContent}>
        <ArtworkDetailBody artwork={artwork} artist={artist} />
      </div>
    </PageLayout>
  )
}
```

This removes: the `isInternal` branch, `handleClose`/`router.back`, the `the-art-room:internal-nav` read+remove, the `Logo`/`minimalHeader`/`closeButton`, the duplicated body, and now-unused imports. The route at `src/app/artworks/[slug]/page.tsx` still passes `{ artwork, artist }` — unchanged.

- [ ] **Step 2: Delete dead SCSS classes**

In `src/components/artwork/detail/ArtworkDetail.module.scss`, delete these now-unused rules: `.page`, `.minimalHeader`, `.logo`, `.logoText`, `.closeButton`, `.closeIcon`, and `.content` (the fake-modal grid). **Keep** `.standaloneContent`, `.metadata`, `.artistName`, `.title`, `.titleText`, `.year`, `.dimensions`, `.technique`, `.imageContainer`, `.image`, `.description`, `.inquireButton`, `.share` (used by the body).

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0 (no unused-import errors). Then `pnpm dev` and open `/artworks/<a-real-slug>` directly — confirm the standalone page renders with the normal site header + footer, image, metadata, Inquire, and Share. Confirm the Share URL is `http://localhost:3001/artworks/<slug>`.

- [ ] **Step 4: Commit**

```bash
git add src/components/artwork/detail/index.tsx src/components/artwork/detail/ArtworkDetail.module.scss
git commit -m "AR-124: standalone artwork page uses shared body; remove fake-modal mode"
```

---

## Task 6: Redux → body shape mapper

**Files:**
- Create: `src/components/exhibitions/view/ArtworkModal/mapReduxArtwork.ts`

- [ ] **Step 1: Create the mapper**

Create `src/components/exhibitions/view/ArtworkModal/mapReduxArtwork.ts`:

```ts
import type { TArtwork } from '@/types/artwork'

import type { Artwork, Artist } from '@/components/artwork/detail/ArtworkDetailBody'

/**
 * Map a scene artwork (Redux `TArtwork`) into the body's shapes for an INSTANT first
 * paint. Fields the scene does not hold (description, originalWidth/Height,
 * printEnabled/printPriceCents, the full artist record) are filled by the by-slug fetch.
 */
export function mapReduxArtwork(a: TArtwork): { artwork: Artwork; artist: Artist } {
  return {
    artwork: {
      id: a.id,
      slug: a.slug ?? '',
      name: a.name,
      title: a.artworkTitle ?? null,
      author: a.author ?? null,
      year: a.artworkYear ?? null,
      technique: a.technique ?? null,
      dimensions: a.artworkDimensions ?? null,
      imageUrl: a.imageUrl ?? null,
    },
    artist: { id: '', name: '', lastName: '', handler: '' },
  }
}
```

> Confirm `TArtwork` has an `id: string` field (the scene keys `artworksById` by it). If the id field has a different name, use that.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibitions/view/ArtworkModal/mapReduxArtwork.ts
git commit -m "AR-124: add Redux→body artwork mapper for instant modal paint"
```

---

## Task 7: Create `ArtworkModal`

**Files:**
- Create: `src/components/exhibitions/view/ArtworkModal/ArtworkModal.tsx`
- Create: `src/components/exhibitions/view/ArtworkModal/ArtworkModal.module.scss`

- [ ] **Step 1: Create the styles**

Create `src/components/exhibitions/view/ArtworkModal/ArtworkModal.module.scss`. The `.body` grid mirrors the old `.content` so the look matches the current fake-modal:

```scss
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--color-white);
  overflow-y: auto;

  // Resize safety: never show the modal at mobile widths.
  @media (max-width: 1023px) {
    display: none;
  }
}

.close {
  position: fixed;
  top: var(--space-6);
  right: var(--space-6);
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-primary);
}

.body {
  display: grid;
  grid-template-columns: minmax(160px, 0.25fr) 1fr;
  gap: var(--space-10);
  padding: 0 var(--space-10) var(--space-10);
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
}
```

- [ ] **Step 2: Create the component**

Create `src/components/exhibitions/view/ArtworkModal/ArtworkModal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { X } from 'lucide-react'

import { ArtworkDetailBody, type Artwork, type Artist } from '@/components/artwork/detail/ArtworkDetailBody'
import { Button } from '@/components/ui/Button'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { closeArtworkModal } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'

import { mapReduxArtwork } from './mapReduxArtwork'
import styles from './ArtworkModal.module.scss'

type FetchedDetail = { artwork: Partial<Artwork>; artist: Artist }

export const ArtworkModal = () => {
  const dispatch = useDispatch()
  const isMobile = useIsMobile()
  const currentArtworkId = useSelector((state: RootState) => state.scene.currentArtworkId)
  const reduxArtwork = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId] : null,
  )
  const slug = reduxArtwork?.slug
  const [fetched, setFetched] = useState<FetchedDetail | null>(null)

  // Backfill the fields the scene doesn't hold (description, print, dims, full artist).
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setFetched(null)
    fetch(`/api/artworks/by-slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FetchedDetail | null) => {
        if (!cancelled && data) setFetched(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug])

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(closeArtworkModal())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (isMobile || !reduxArtwork) return null

  const base = mapReduxArtwork(reduxArtwork)
  const artwork: Artwork = { ...base.artwork, ...(fetched?.artwork ?? {}) }
  const artist: Artist = fetched?.artist ?? base.artist

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <Button
        variant="ghost"
        className={styles.close}
        onClick={() => dispatch(closeArtworkModal())}
        aria-label="Close artwork"
      >
        <X size={20} strokeWidth={ICON_STROKE_WIDTH} />
      </Button>
      <div className={styles.body}>
        <ArtworkDetailBody artwork={artwork} artist={artist} />
      </div>
    </div>
  )
}

export default ArtworkModal
```

> Uses the shared `Button` component (project rule: never a native `<button>`); mirror how `ArtworkPanel`'s close button passes `variant="ghost"` + `className` + an `X` child. Confirm the scene slice path `state.scene.currentArtworkId` and the artworks slice path `state.artworks.byId` match the store (the existing `ArtworkPanel` reads both).
>
> **A11y scope:** `role="dialog"` + `aria-modal` + Esc-to-close + scroll-lock are included. A full focus trap / return-focus is intentionally deferred — the overlay is full-screen and the trigger (View Details, in the now-closed sidebar) no longer exists to return focus to. Add a focus trap later if a keyboard-a11y pass calls for it.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0. (Not yet rendered — wired in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add src/components/exhibitions/view/ArtworkModal/ArtworkModal.tsx src/components/exhibitions/view/ArtworkModal/ArtworkModal.module.scss
git commit -m "AR-124: add ArtworkModal (instant paint + backfill, esc/scroll-lock, mobile-safe)"
```

---

## Task 8: Render the modal in the exhibition view

**Files:**
- Modify: `src/components/exhibitions/view/index.tsx`

- [ ] **Step 1: Import the modal + select the flag**

Add the import near the `ArtworkPanel` import:

```ts
import { ArtworkModal } from '@/components/exhibitions/view/ArtworkModal/ArtworkModal'
```

Find where `isArtworkPanelOpen` is selected from Redux and add alongside it:

```ts
const isArtworkModalOpen = useSelector((state: RootState) => state.dashboard.isArtworkModalOpen)
```

- [ ] **Step 2: Render it**

In the desktop `return (...)` block, render the modal next to the panel (after the `{isArtworkPanelOpen && <ArtworkPanel />}` line, ≈ line 606):

```tsx
      {isArtworkPanelOpen && <ArtworkPanel />}
      {isArtworkModalOpen && <ArtworkModal />}
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0. (Nothing dispatches `openArtworkModal` yet — wired in Task 9.)

- [ ] **Step 4: Commit**

```bash
git add src/components/exhibitions/view/index.tsx
git commit -m "AR-124: render ArtworkModal in the exhibition view when open"
```

---

## Task 9: Rewire "View Details" → open modal, close sidebar

**Files:**
- Modify: `src/components/editview/ArtworkPanel/ArtworkPanel.tsx`

- [ ] **Step 1: Replace the navigation handler**

In `src/components/editview/ArtworkPanel/ArtworkPanel.tsx`:

1. Remove the `getCameraState` import (line 13) and the `useRouter` import/usage if it becomes unused after this change.
2. Add `openArtworkModal` to the dashboard-slice import (alongside `hideArtworkPanel`):

```ts
import { hideArtworkPanel, openArtworkModal } from '@/redux/slices/dashboardSlice'
```

3. Replace the entire `handleViewDetails` function (currently lines ~44-59, which saves camera state + `internal-nav` and `router.push`) with:

```ts
  const handleViewDetails = () => {
    if (!selectedArtwork?.id) return
    // Open the in-exhibition modal over the live scene and close the sidebar beneath it,
    // so dismissing the modal returns to a clean scene with no sidebar lingering.
    dispatch(hideArtworkPanel())
    dispatch(openArtworkModal())
  }
```

`setCurrentArtwork` already holds the selected artwork id (set on double-click), and the modal reads `state.scene.currentArtworkId`, so no extra dispatch is needed. If `useRouter`/`router` is now unused, delete its import and the `const router = useRouter()` line.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0 (watch for an unused-`router`/`useRouter` lint error — delete if flagged).

Then `pnpm dev`, open `/exhibitions/john-doe/landscapes/visit` (with a saved exhibition where "Show information in exhibition" is on), double-click an artwork → sidebar opens → click **View Details**:
- The sidebar closes and the full-screen modal opens over the scene **instantly**, image already visible (no flash).
- The 3D scene is NOT reloaded (no blank/reload).
- Press **Esc** and click the **X** — both close instantly; the camera is exactly where it was.
- After closing, the sidebar is not left open.
- Open DevTools Network: when the modal opens, the artwork image shows "from disk cache" / no new download.

- [ ] **Step 3: Commit**

```bash
git add src/components/editview/ArtworkPanel/ArtworkPanel.tsx
git commit -m "AR-124: View Details opens the modal and closes the sidebar (no navigation)"
```

---

## Task 10: Remove camera-state save/restore plumbing

Now that the scene never unmounts, the camera-state machinery is dead.

**Files:**
- Modify: `src/components/scene/controls/MainCamera/MainCamera.tsx`

- [ ] **Step 1: Remove the restore effect**

In `src/components/scene/controls/MainCamera/MainCamera.tsx`, delete the entire "Restore camera from sessionStorage" `useLayoutEffect` (lines ~156-174, the block reading `the-art-room:camera-state`). The next `useLayoutEffect` (GLB initial position) becomes the first one and handles initial placement.

- [ ] **Step 2: Remove the module-level snapshot + getter + per-frame write**

Delete the `currentCameraState` declaration (lines ~98-102) and the `export const getCameraState = () => currentCameraState` (line ~105). Then delete the per-frame write block (lines ~513-522):

```ts
    // Track camera state for save/restore on artwork detail navigation
    currentCameraState = {
      position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      quaternion: {
        x: cam.quaternion.x,
        y: cam.quaternion.y,
        z: cam.quaternion.z,
        w: cam.quaternion.w,
      },
    }
```

If `useLayoutEffect` is no longer used anywhere in the file after Step 1, remove it from the React import.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0. There should be **no** remaining references to `getCameraState` or `the-art-room:camera-state` anywhere:

```bash
grep -rn "getCameraState\|the-art-room:camera-state" src
```
Expected: no matches.

Then `pnpm dev` and confirm the exhibition still loads with the correct initial camera placement, and walking around still works.

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/controls/MainCamera/MainCamera.tsx
git commit -m "AR-124: remove dead camera-state save/restore plumbing"
```

---

## Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Static checks**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0.

- [ ] **Step 2: Confirm artwork-detail internal-nav is fully gone (entry flow preserved)**

```bash
grep -rn "the-art-room:internal-nav" src
```
Expected: matches ONLY in `src/components/exhibitions/profile/EnterExhibitionButton.tsx` and `src/components/exhibitions/view/index.tsx` (the exhibition-entry flow). NO matches in `artwork/detail/index.tsx` or `ArtworkPanel.tsx`.

- [ ] **Step 3: Production build (SSR/RSC safety — this touches the import graph)**

Run: `pnpm build && pnpm start -p 3001`
Expected: build succeeds; then hit `/artworks/<slug>` (standalone) and `/exhibitions/john-doe/landscapes/visit` and confirm both render with no server error.

- [ ] **Step 4: Manual QA checklist (desktop, `pnpm dev`)**

- [ ] Double-click artwork → sidebar opens (unchanged).
- [ ] View Details → sidebar closes + modal opens instantly; image present immediately (Network: from cache).
- [ ] Esc closes; X closes; both instant, camera unchanged, scene not reloaded.
- [ ] After closing, no sidebar lingering.
- [ ] Inquire (inside modal) opens the InquireSidebar above the modal and works.
- [ ] Share shows `${origin}/artworks/<slug>` — identical to the standalone page's URL.
- [ ] Order Print navigates to `/artworks/<slug>/print`.
- [ ] `description` and the Order-Print button appear after the brief backfill (no jank).
- [ ] Resize the desktop window below 1024px while the modal is open → modal disappears (no broken layout).
- [ ] Standalone `/artworks/<slug>` still renders with header + footer.

- [ ] **Step 5: Commit any final touch-ups**

```bash
git add -A
git commit -m "AR-124: verification pass — modal flow end-to-end"
```

---

## Out of scope (follow-up)

- The texture cache (`821a391`) lives on `feat/AR-123`, not this branch — nothing to remove here. When AR-124 sits on top of AR-123's cache at merge time, delete the cache then (it becomes dead code once the scene never unmounts).
- `package.json` version bump and prod DB sync are AR-123 concerns, not this plan.
