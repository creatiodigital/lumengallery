/**
 * Base URL for the static 3D assets (models, PBR textures, HDRI).
 *
 * These live on Cloudflare R2 (`assets.theartroom.gallery/app`) — the single
 * canonical copy for EVERY environment (prod, staging, localhost). The old
 * `public/assets` 3D files were deleted from the app/Vercel in AR-127, so the
 * R2 URL is the only valid source; that is why it is the hard-coded DEFAULT
 * here rather than an empty origin-relative fallback.
 *
 * `NEXT_PUBLIC_ASSETS_URL` stays as an optional OVERRIDE (e.g. to point a build
 * at a different bucket/prefix). It is NOT load-bearing: if it is missing or
 * empty, assets still resolve to R2 — so a missing build-time var can no longer
 * 404 every 3D scene (the AR-127 prod outage, 2026-06-14).
 *
 * NEXT_PUBLIC_* is inlined at build time, so changing the override needs a rebuild.
 */
const DEFAULT_ASSETS_URL = 'https://assets.theartroom.gallery/app'

const override = process.env.NEXT_PUBLIC_ASSETS_URL
const BASE = override && override.trim() !== '' ? override : DEFAULT_ASSETS_URL

/**
 * LOCAL DEV ONLY — per-file override, for iterating on an asset before it is
 * uploaded to R2 (e.g. testing a re-exported space GLB).
 *
 * `NEXT_PUBLIC_LOCAL_ASSETS` is a comma-separated list of EXACT asset paths to
 * serve from the app's own origin (i.e. `public/<path>`) instead of R2.
 * Everything not listed still comes from R2, so there is no need to mirror the
 * whole asset tree — list only the file you are changing:
 *
 *   NEXT_PUBLIC_LOCAL_ASSETS=/assets/spaces/madrid/madrid10.glb,/assets/spaces/paris/paris19.glb
 *
 * Guards, deliberately belt-and-braces because a bad value here took every 3D
 * scene down once already (AR-127, 2026-06-14):
 *  - Honoured ONLY when NODE_ENV === 'development'. A stray value in a prod or
 *    staging build is inert, so this can never 404 a deployed scene.
 *  - Matching ignores any `?v=` cache-buster on the request.
 *
 * NEXT_PUBLIC_* is inlined at build time — restart the dev server after editing.
 */
const LOCAL_PATHS: ReadonlySet<string> =
  process.env.NODE_ENV === 'development'
    ? new Set(
        (process.env.NEXT_PUBLIC_LOCAL_ASSETS ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : new Set()

export const assetUrl = (path: string): string => {
  if (LOCAL_PATHS.size > 0 && LOCAL_PATHS.has(path.split('?')[0])) return path
  return `${BASE}${path}`
}
