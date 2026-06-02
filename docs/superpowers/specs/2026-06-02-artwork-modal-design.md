# Artwork detail: route → real modal (AR-124)

- **Date:** 2026-06-02
- **Branch:** `feat/AR-124-turn-artwork-page-into-modal`
- **Scope:** Desktop exhibition "visit" view only.

## Problem / motivation

From the exhibition visit view, clicking **View Details** on the artwork info sidebar
navigates to `/artworks/[slug]` — a standalone route rendered in a "fake modal"
(`isInternal`) mode with a minimal header (logo + CLOSE) over a full page.

Because it is a real route, opening it **unmounts** the 3D exhibition and closing it
(`router.back()`) **remounts** it from scratch. That remount is the root cause of a
cascade of complexity: every artwork texture reloads (blank flash), which forced a
texture cache, plus camera-state save/restore and `internal-nav` sessionStorage flags
to paper over the unmount.

"A page that looks like a modal" is the wrong architecture. A real in-app modal rendered
*over* the still-mounted exhibition removes the whole class of problem: dismiss is
instant because nothing ever unmounted.

## Goals

- Replace the fake-modal route flow with a real full-screen modal overlaid on the live
  exhibition scene.
- Modal content is visually identical to the real artwork page **minus the page header
  and footer** — just the artwork body plus a single **X** (top-right).
- Opening the modal is **instant** — no spinner, no blank image ("no lazy modal").
- Share from the modal yields the **exact same URL** as the real artwork page.
- The standalone `/artworks/[slug]` route still exists (for shared links / direct visits).
- Net simplification: delete the camera-state and sessionStorage plumbing.

## Non-goals

- Mobile: the 3D exhibition is not shown on mobile, so there is no View Details → modal
  flow there. The modal must still **self-hide below the mobile breakpoint** as a
  resize-safety measure, but no mobile feature is built.
- No URL change while the modal is open (decided: option A). Sharing is handled by the
  existing Share button, which reconstructs the canonical URL.
- Do **not** touch the R3F render loop. The modal is simply layered on top.

## Decisions (locked with user)

1. **No URL change** when the modal opens. Share button builds the link from the slug.
2. **Extract, don't copy.** One shared `ArtworkDetailBody` used by both the route and the
   modal. The only per-context difference is the chrome around the body.
3. **Entry point:** double-click still opens the lightweight `ArtworkPanel` sidebar;
   **View Details** closes the sidebar and opens the modal.
4. **Desktop only**; modal hidden on mobile widths regardless.
5. **Data via fetch** (`/api/artworks/by-slug/[slug]`), but pre-filled from Redux so the
   modal is instant (see Fast-open).
6. **Share URL** = `${origin}/artworks/${artwork.slug}` — byte-identical to the page.
7. **Image:** shared body renders the raw `imageUrl` via a plain `<img>` (both page and
   modal). Makes the modal image a browser-cache hit from the scene's already-loaded
   texture; consistent with `ArtworkPanel`; avoids the known `next/image` + R2 prod issue.

## Architecture & components

### `ArtworkDetailBody` (new, client)

Extracted from the currently-duplicated block in
`src/components/artwork/detail/index.tsx` (the `.metadata` + `.imageContainer` exist
identically in both the `isInternal` and standalone branches).

- Renders: author, title/year, technique, dimensions, description, **Inquire** button,
  **Order Print** button (conditional), **Share**, and the artwork image.
- Owns local `isInquireOpen` state and renders `<InquireSidebar>`.
- Props: `{ artwork, artist }` (same shapes as today's `ArtworkDetailPage`).
- Image: plain `<img src={artwork.imageUrl}>` with `crossOrigin="anonymous"` (match
  THREE's texture request so the browser-cache entry is reused) and eager loading.
- Share URL computed as `${origin}/artworks/${artwork.slug}` (not `pathname`).
- Every field is rendered conditionally (already true today), so a partially-populated
  `artwork` renders cleanly and fills in as more data arrives.

### `ArtworkDetailPage` (route, simplified)

`src/components/artwork/detail/index.tsx` becomes:
`<PageLayout><ArtworkDetailBody artwork={…} artist={…} /></PageLayout>`.

Delete: the entire `isInternal` branch, `handleClose`, `router.back`, the
`Logo`/`minimalHeader`/`closeButton`, and the `internal-nav` sessionStorage read.

### `ArtworkModal` (new)

Full-screen fixed overlay that covers the viewport like a page, with a single **X**
(top-right) and `<ArtworkDetailBody>` inside.

- Mounted by `ExhibitionViewPage` when `isArtworkModalOpen` is true.
- Reads the open artwork from Redux (`artworksById[currentArtworkId]`), maps it to the
  body's `artwork` shape, and renders immediately (Fast-open step 1). The mapper bridges
  the Redux field names to the body's (`artworkTitle`→`title`, `artworkYear`→`year`,
  `artworkDimensions`→`dimensions`; `author`, `name`, `technique`, `imageUrl`, `slug`
  pass through).
- Fetches `/api/artworks/by-slug/[slug]` and merges the backfill fields when they arrive.
- Closes on **X** or **Esc** → `closeArtworkModal()`.
- Renders `null` below the mobile breakpoint (and CSS `display:none` as backstop). Reuse
  the **same mobile detection `ExhibitionViewPage` already uses** for its
  `MobileExhibitionView` branch, so the threshold stays consistent.

## Interaction & state

- New Redux flag `isArtworkModalOpen` (dashboardSlice), reusing existing
  `currentArtworkId` (sceneSlice).
- **View Details** handler (in `ArtworkPanel`) becomes:
  `dispatch(hideArtworkPanel())` + `dispatch(openArtworkModal())`. No `router.push`, no
  camera save, no sessionStorage. Sidebar closes, modal opens over the live scene.
- **Close** → `dispatch(closeArtworkModal())`. Scene was never unmounted → instant,
  camera unchanged.
- **Order Print** stays a real `router.push('/artworks/{slug}/print')` (intentionally
  leaves the exhibition for the print flow).

## Data flow & fast-open strategy

The modal must open with no perceptible latency:

1. **Pre-fill from Redux, instantly.** `artworksById[currentArtworkId]` already holds
   author, title, year, technique, dimensions, slug, imageUrl. The body renders from this
   on the same frame the modal opens. No spinner.
2. **Backfill in the background.** The `by-slug` fetch supplies only the fields Redux
   lacks — `description`, `printEnabled`, `printPriceCents`, `originalWidth/Height`. They
   appear a beat later without blocking or janking (conditional rendering).
3. **Image cache hit.** The scene already downloaded `imageUrl` for its texture, so the
   modal's `<img src={imageUrl}>` is served from the browser cache — instant. Match
   `crossOrigin="anonymous"` to THREE's request so the same cache entry is reused; verify
   "from disk cache" / no new request in the Network tab.

### API change

Add `originalWidth` and `originalHeight` to the response of
`src/app/api/artworks/by-slug/[slug]/route.ts` (currently missing; the standalone page's
server query includes them for the image dimensions). Without this the modal image falls
back to 800×800.

## Cleanup (the payoff)

- Remove camera-state **save** in `src/components/editview/ArtworkPanel/ArtworkPanel.tsx`
  (`getCameraState` + `the-art-room:camera-state` write).
- Remove camera-state **restore** in
  `src/components/scene/controls/MainCamera/MainCamera.tsx` (the `useLayoutEffect` that
  reads `the-art-room:camera-state`).
- Remove all `the-art-room:internal-nav` usage.
- Remove now-dead styles from `ArtworkDetail.module.scss` (`minimalHeader`, `logo`,
  `closeButton`, `page`, `content`) unless reused by the modal overlay; add modal overlay
  styles.

### Out of scope / follow-up

- The texture cache (`821a391`) lives on `feat/AR-123`, not this branch — there is nothing
  to revert here. When AR-124 is eventually rebased/merged on top of AR-123's cache, delete
  the cache then; until then it is harmless dead code.

## Edge cases & accessibility

- Modal: body scroll-lock while open, focus trap, **Esc** to close, return focus to the
  trigger on close, `role="dialog"` / `aria-modal`.
- The full-screen overlay captures pointer/keyboard so the scene beneath receives no
  interaction (requirement #6) — achieved by the overlay covering the canvas; no
  render-loop change.
- `by-slug` fetch error / not found → keep the Redux-pre-filled view; if the artwork is
  truly missing, close the modal gracefully. Never break the scene.
- Resize desktop → mobile while open: modal hides (matchMedia + CSS).

## Testing / verification

Manual on desktop:

- View Details → sidebar closes + modal opens **instantly**, image present immediately
  (Network tab shows image from cache, no new request).
- Esc and X both close instantly; camera is exactly where it was (no reload, no flash).
- Inquire opens over the modal and works as on the real page.
- Share copies `${origin}/artworks/{slug}` (identical to the standalone page).
- Order Print navigates to the print wizard.
- Resize to mobile width hides the modal.
- Standalone `/artworks/{slug}` still renders correctly with header + footer.

Automated e2e: skipped — mounts the WebGL scene (per project e2e conventions, no
WebGL-mounting e2e).
