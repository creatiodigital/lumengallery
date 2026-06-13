import type { ProviderId, Quote, SpecsSummary, WizardConfig } from '@/lib/print-providers'
import { TPS_GALLERY_MARKUP_RATE } from '@/lib/print-providers/printspace/pricing'
import type { CartItem } from './types'

type ArtworkMeta = {
  id: string
  slug: string
  title: string
  artistName: string
  thumbnailUrl: string
}

type BuildCartItemInput = {
  artwork: ArtworkMeta
  providerId: ProviderId
  editionType: 'open' | 'limited'
  variantId?: string
  config: WizardConfig
  quote: Quote
  /** Artist's share in cents (printPriceCents or variant.priceCents). */
  artistCents: number
  specsSummary: SpecsSummary
}

/**
 * Builds the non-lineId fields of a CartItem from wizard add-to-cart
 * inputs. Extracted to remove duplication between OpenWizard and
 * LimitedWizard. The price split mirrors the canonical calculation in
 * createPaymentIntent.ts — the server re-derives it at payment.
 */
export function buildCartItem(input: BuildCartItemInput): Omit<CartItem, 'lineId'> {
  const { artwork, providerId, editionType, variantId, config, quote, artistCents, specsSummary } =
    input

  const galleryCents = Math.round(artistCents * TPS_GALLERY_MARKUP_RATE)
  const artworkLineCents = quote.lines.find((l) => l.id === 'artwork')?.amountCents ?? 0
  const productionCents = Math.max(0, artworkLineCents - artistCents - galleryCents)

  return {
    artworkSlug: artwork.slug,
    artworkId: artwork.id,
    providerId,
    editionType,
    ...(variantId !== undefined ? { variantId } : {}),
    config,
    quantity: 1,
    unitArtistCents: artistCents,
    unitProductionCents: productionCents,
    unitGalleryCents: galleryCents,
    thumbnailUrl: artwork.thumbnailUrl,
    title: artwork.title,
    artistName: artwork.artistName,
    specsSummary,
  }
}
