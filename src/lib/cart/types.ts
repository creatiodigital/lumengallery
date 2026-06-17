import type { ProviderId, SpecsSummary, WizardConfig } from '@/lib/print-providers'

export type CartItem = {
  // Stable per-line id (uuid) so quantity edits/removes target one line.
  lineId: string
  artworkSlug: string
  artworkId: string
  providerId: ProviderId
  editionType: 'open' | 'limited'
  variantId?: string // limited only
  config: WizardConfig
  quantity: number
  // Display snapshot captured at add time (re-validated server-side at checkout).
  unitArtistCents: number
  unitProductionCents: number
  unitGalleryCents: number
  thumbnailUrl: string
  title: string
  artistName: string
  /** Specs snapshot captured at add time — drives CartLine display. */
  specsSummary: SpecsSummary
  // Limited-edition cart hold (filled by the reservation step in a later task; optional now).
  editionNumberIds?: string[]
  holdExpiresAt?: number // epoch ms, server-provided
}

export type CartItemTotals = {
  unitItemCents: number // artist + production + gallery, per unit (pre-shipping, pre-VAT)
  lineItemCents: number // unitItemCents x quantity
}
