# Move 3D Assets from Vercel to R2 — Design

**Date:** 2026-06-12
**Branch:** existing dedicated branch (branch 1 of 3 in the current feature cycle)
**Status:** Approved design, pending implementation plan

## Goal

Serve all 3D scene/preview assets (~118 MB: glTF models, PBR material textures, HDRI,
space textures) from Cloudflare R2 (`assets.theartroom.gallery`) instead of Vercel.

Motivation:

- **Reliability:** a buyer hit a 404 on a ReflectiveFloor texture in the "vivriere"
  exhibition (June 2026). The floor-loading code is already guarded (material
  validation, alias fallback, resilient texture loader, config matches files on
  disk), so the 404 was Vercel-side transient serving — static assets there are
  re-uploaded on every deploy and can mis-serve during rollouts. R2 object URLs are
  stable and decoupled from deploys.
- **Performance:** Cloudflare edge caching with immutable headers; zero egress cost.
- **Deploy weight:** drops ~190 MB from every Vercel deployment.

## Scope

**Moves to R2 (everything 3D in use, ~118 MB):**

- `public/assets/materials/**` — 15 PBR material folders (floor/wall/frame textures)
- `public/assets/spaces/**` — `madrid9.glb`, `paris18.glb` + their texture folders
- `public/assets/hdri/soil.hdr` (16 MB)
- `public/assets/human.glb` (17 MB — admin-only proportions reference, moves for
  deploy weight, exempt from loading-time concerns)

**Stays on Vercel (2D UI, ~3.6 MB):**

- `email-logo.png`, `landing/carousel*.webp`, `helpers/*.jpg`, `person.png`

**Deleted (not uploaded):**

- `public/assets/objects/sofa/sofa.glb` (72 MB) + `src/components/PrintWizard/scene/Sofa.tsx`
  — confirmed by user as a test; the component is imported nowhere and never renders
- `textures/window-shadow.png` — referenced nowhere, dead file
- all `.DS_Store` files

**Out of scope (separate future branch):** asset compression (gltf-transform /
Draco, texture downsizing, lower-res HDRI). No KTX2 ever (hard rule).

## Architecture

### 1. `assetUrl()` helper (chosen approach)

New `src/lib/assetUrl.ts`:

```ts
const BASE = process.env.NEXT_PUBLIC_ASSETS_URL ?? ''
export const assetUrl = (path: string) => `${BASE}${path}`
```

All **3D** asset references (~40 refs across ~20 files: `useGLTF`,
`useTexture`/`useResilientTexture`, HDRI loader, inline-style frame textures in
`ArtisticImage`/`ArtisticVideo`) are wrapped:
`assetUrl('/assets/materials/parquet/diffuse.jpg?v=3')`.
2D references are left untouched.

- Env var unset → output identical to today → refactor ships with zero behavior
  change, fully decoupled from the infra flip.
- `NEXT_PUBLIC_*` is inlined at build time → flipping requires a redeploy;
  rollback = unset var + redeploy.

Rejected alternatives: hardcoded R2 URLs (no rollback lever, no per-env control);
Vercel rewrite/proxy to R2 (keeps Vercel in the serving path and its egress bill —
defeats both goals).

### 2. Fix known 404 sources (in this branch)

- **Phantom `paris10.glb` (9 files):** wallview panels + `exhibitions/edit`
  reference `/assets/spaces/paris/paris10.glb?v=2`, which does not exist (only
  `paris18.glb` does). Investigate intent (stale `useGLTF` preloads?); point at
  `paris18.glb` or remove.
- **Phantom thumbnails:** `scene/constants.tsx` references
  `/assets/thumbnails/{madrid,paris}.jpg`; the folder does not exist. Check where
  they render; add real thumbnails or drop the references.

### 3. R2 layout — strict separation, one shared copy

- Same bucket, same creds as runtime uploads. New **top-level prefix `app/`**,
  a sibling of — never inside — the existing `production/` / `staging/` upload
  folders. Artist photos/artworks paths are untouched; `scripts/reconcile-r2.ts`
  (runtime-upload domain) never touches `app/`.
- **One canonical copy serves every environment** (prod, staging, localhost).
  No per-env duplication: these are version-controlled build assets, not user
  data. The only per-env difference is whether `NEXT_PUBLIC_ASSETS_URL` is set;
  its value is identical everywhere:
  `NEXT_PUBLIC_ASSETS_URL=https://assets.theartroom.gallery/app`
- Final URL shape:
  `https://assets.theartroom.gallery/app/assets/materials/parquet/diffuse.jpg?v=3`
  (helper prepends base to the existing `/assets/...` path — paths keep their
  current shape, so the layout under `app/` mirrors `public/`).
- `?v=N` cache-busting convention stays (immutable caching requires it on
  replacement).

### 4. Upload — one-off script, run by Claude, no manual steps

`scripts/upload-3d-assets.ts` (ts-node, mirrors `reconcile-r2.ts` conventions):

- Uses the existing `@aws-sdk/client-s3` dependency and R2 creds from `.env.local`
  (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`)
  — no new dependencies, no rclone/aws CLI install.
- Walks only the in-scope 3D paths, skips `.DS_Store`.
- Sets correct `Content-Type` per extension (`model/gltf-binary` for `.glb`,
  `image/jpeg`, `image/png`, `application/octet-stream` for `.hdr`) and
  `Cache-Control: public, max-age=31536000, immutable`.
- Idempotent (safe to re-run), prints summary: files uploaded, total bytes,
  local-vs-remote count check.

### 5. R2 CORS (make-or-break)

Three.js loaders fetch with `crossOrigin='anonymous'` — without CORS, glbs and
textures fail even on HTTP 200 (phantom-error mode). Bucket CORS must allow `GET`
from:

- `https://theartroom.gallery`
- `https://staging.theartroom.gallery`
- `http://localhost:3001`

Configured in the Cloudflare dashboard (cannot be done from the repo). A glb
failing CORS = whole scene mounts empty, so verification (step 4 below) gates
every env flip.

## Rollout order (each step independently safe)

1. **Code refactor** — `assetUrl()` + phantom-ref fixes. Env var unset everywhere;
   zero behavior change.
2. **R2 CORS** — configure the three origins (user, Cloudflare dashboard).
3. **Upload** — Claude runs `scripts/upload-3d-assets.ts`; spot-check URLs in the
   browser.
4. **Local test (gate):** set `NEXT_PUBLIC_ASSETS_URL` in `.env.local`; verify in
   dev AND in a local prod build (`pnpm build && pnpm start -p 3001`):
   `/visit` exhibition, print wizard 3D preview, wall editor, admin exhibition
   editor (human.glb). Network tab shows R2 origin; no CORS errors; no 404s.
5. **Staging flip** — set var in Vercel staging env, redeploy, re-verify (user OK
   required before this step).
6. **Prod flip** — same var in prod, redeploy, re-verify.
7. **Delete** — only after prod is verified: remove the 3D files from
   `public/assets/` in a separate commit (trivially revertable). Vercel deploy
   drops ~190 MB.

Nothing is committed or pushed at any step without the user testing and approving
first (standing workflow rule).

## Error handling

No new runtime error handling needed: `useResilientTexture` (retry + graceful
degradation) already wraps texture loading and works identically against R2.
The CORS + verification gates in the rollout are the error-prevention mechanism.

## Testing

- No new e2e: the 3D scenes are excluded from Playwright by standing rule (WebGL
  fan/CPU). Verification is the manual checklist in rollout steps 4–6.
- Local prod build before pushing (env-var inlining is build-graph-adjacent).
- `pnpm typecheck` + `pnpm lint` for the refactor.

## Open items for the implementation plan

- Decide fix per phantom `paris10.glb` reference (point at `paris18.glb` vs
  remove) after reading the 9 call sites.
- Decide thumbnails: add images vs remove references, after checking render path.
- Confirm exact `app/assets/...` vs `app/...` key prefix once the helper's path
  joining is written (URL shape above is the contract; key layout follows it).
