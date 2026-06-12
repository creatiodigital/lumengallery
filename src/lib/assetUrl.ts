/**
 * Base URL for build-time static 3D assets (models, PBR textures, HDRI).
 *
 * Unset → '' → paths resolve against the app origin (public/assets on
 * Vercel, current behavior). Set to https://assets.theartroom.gallery/app
 * → the same paths resolve against the single canonical R2 copy shared by
 * every environment (prod, staging, localhost).
 *
 * NEXT_PUBLIC_* is inlined at build time — flipping it requires a rebuild.
 */
const BASE = process.env.NEXT_PUBLIC_ASSETS_URL ?? ''

export const assetUrl = (path: string): string => `${BASE}${path}`
