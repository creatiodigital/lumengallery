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

export const assetUrl = (path: string): string => `${BASE}${path}`
