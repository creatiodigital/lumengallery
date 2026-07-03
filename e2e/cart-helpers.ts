import type { Page } from '@playwright/test'

/**
 * Cart seeding for e2e — WITHOUT the print wizard.
 *
 * The whole add-to-cart UI is built on the wizard, which mounts an R3F/Three.js
 * WebGL preview (CPU/fan-heavy and banned from e2e). So instead of driving the
 * wizard, we write a fully-formed cart straight into localStorage under the
 * provider's storage key, then load `/cart` — the `CartProvider` hydrates from
 * it on mount exactly as if the buyer had added the items. This lets us test
 * every cart-page behavior (stepper, remove-confirm, edit link, spec toggle,
 * hold countdown, totals, badge) with zero 3D.
 *
 * `addInitScript` runs before the app's first script, so the cart is present at
 * first paint — same approach as `seedCookieConsent`.
 */

const CART_STORAGE_KEY = 'the-art-room:cart'

export type SeedSpec = { id: string; label: string; value: string }

export type SeedCartItem = {
  lineId: string
  artworkSlug: string
  artworkId: string
  providerId: string
  editionType: 'open' | 'limited'
  variantId?: string
  config: {
    values: Record<string, string>
    customSize?: { widthCm: number; heightCm: number }
    borders?: Record<string, { allCm: number }>
  }
  quantity: number
  unitArtistCents: number
  unitProductionCents: number
  unitGalleryCents: number
  thumbnailUrl: string
  title: string
  artistName: string
  specsSummary: SeedSpec[]
  editionNumberIds?: string[]
  holdExpiresAt?: number
}

const DEFAULT_SPECS: SeedSpec[] = [
  { id: 'printType', label: 'Print type', value: 'Giclée' },
  { id: 'paper', label: 'Paper', value: 'Hahnemühle German Etching' },
  { id: 'size', label: 'Print size', value: '30 × 20 cm' },
  { id: 'border', label: 'Paper border', value: '3 cm' },
]

/**
 * Build a complete cart line, overriding only what a test asserts on. Default
 * money is a clean €100.00 per unit (artist 60 + production 30 + gallery 10),
 * so quantity 2 reads €200.00 — easy to assert against.
 */
export function makeCartItem(overrides: Partial<SeedCartItem> & { lineId: string }): SeedCartItem {
  return {
    artworkSlug: 'landscape-and-river-52416',
    artworkId: 'art-1',
    providerId: 'printspace',
    editionType: 'open',
    config: { values: { paper: 'german-etching', size: 'a4' } },
    quantity: 1,
    unitArtistCents: 6000,
    unitProductionCents: 3000,
    unitGalleryCents: 1000,
    thumbnailUrl: 'https://example.com/thumb.webp',
    title: 'Landscape and River',
    artistName: 'John Doe',
    specsSummary: DEFAULT_SPECS,
    ...overrides,
  }
}

/** Seed the cart in localStorage before first paint so `CartProvider` hydrates it. */
export async function seedCart(page: Page, items: SeedCartItem[]): Promise<void> {
  await page.addInitScript(
    (payload: { key: string; value: string }) => {
      window.localStorage.setItem(payload.key, payload.value)
    },
    { key: CART_STORAGE_KEY, value: JSON.stringify(items) },
  )
}
