'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import { usePurchasesPaused } from '@/hooks/usePurchasesPaused'
import type { ArtworkSale } from '@/lib/editions/artworkSale'
import { formatEuro } from '@/lib/print-providers'

import styles from './ArtworkGrid.module.scss'

type Artwork = {
  id: string
  slug: string
  name: string
  title?: string | null
  author?: string | null
  year?: string | null
  technique?: string | null
  dimensions?: string | null
  imageUrl?: string | null
  // Real pixel dimensions when known. Used per-tile so next/image
  // reserves the correct slot — fixes CLS without forcing a square crop.
  originalWidth?: number | null
  originalHeight?: number | null
  /**
   * What this card says about buying a print, resolved server-side by
   * `resolveArtworkSale`. Three states, and they are not interchangeable:
   *
   *   undefined / null        not for sale — no commerce on the card at all
   *   { minPriceCents: n }    on sale at n
   *   { minPriceCents: null } live, but nothing left → "Sold out"
   *
   * This is per-artwork rather than per-grid because the artist and exhibition
   * grids hold everything an artist made, sellable or not. /prints could use a
   * grid-wide flag only because its query had already filtered the list down to
   * purchasable work.
   */
  sale?: ArtworkSale | null
}

interface ArtworkGridProps {
  artworks: Artwork[]
  artistName?: string
}

/**
 * Whether a listing card shows its price. OFF as of 2026-08-26, on every grid —
 * /prints, the artist page and the exhibition page.
 *
 * The reasoning is about what a price does BEFORE a buyer has fallen for the
 * work. On a grid it invites two comparisons that have nothing to do with the
 * art: this work against the one beside it, and the number against the buyer's
 * budget — both made before they have really looked. The figure appears in the
 * wizard instead, where it is exact rather than a floor, and where the buyer has
 * already chosen the work.
 *
 * HIDDEN, not removed. Everything behind it still works: `resolveArtworkSale`
 * still resolves, the price still reaches the client, and the "Sold out" badge
 * still depends on the same three-state answer. Flip this to `true` and the
 * figure is back, nothing else to change.
 */
const SHOW_PRICE_ON_LISTINGS = false

// Fallback ratio for legacy artworks uploaded before EXIF capture.
// 4:3 is closer to the average gallery image than 1:1 and avoids the
// jarring shift a square placeholder gives when the real image is wide.
const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 600

/**
 * Whole euros on a listing — a gallery quotes 450, not 449.67.
 *
 * Production costs are ceilinged to the euro and the gallery cut is 40% of an
 * artist price we set in fives, so this figure arrives already whole and the
 * bare number is the exact one the buyer pays.
 *
 * When it doesn't — an artist price like €233 makes the 40% cut €93.20 — we
 * print the cents rather than hide them. `Math.round` used to round DOWN here,
 * so a €443.20 print advertised as €443 and charged €443.20: advertising below
 * the checkout price, which is the one direction that draws complaints. Showing
 * the true figure keeps the listing honest and makes the mispriced artwork
 * visible instead of silently absorbing it.
 */
const formatEuros = (cents: number) =>
  cents % 100 === 0 ? `€${(cents / 100).toLocaleString('es-ES')}` : formatEuro(cents)

export const ArtworkGrid = ({ artworks, artistName }: ArtworkGridProps) => {
  // Admin kill switch. Hides the whole commerce block — price, CTA and the
  // sold-out badge alike — across every grid that uses this component. The
  // wizard and the payment actions still enforce the pause server-side.
  const purchasesPaused = usePurchasesPaused()

  return (
    <div className={styles.grid}>
      {artworks.map((artwork) => {
        const w = artwork.originalWidth ?? FALLBACK_WIDTH
        const h = artwork.originalHeight ?? FALLBACK_HEIGHT
        const sale = purchasesPaused ? null : artwork.sale
        return (
          <div key={artwork.id} className={styles.card}>
            <div className={styles.imageWrapper}>
              {artwork.imageUrl ? (
                <Link href={`/artworks/${artwork.slug}`} className={styles.viewDetailsLink}>
                  <ProtectedImage
                    src={artwork.imageUrl}
                    alt={artwork.title || artwork.name || 'Artwork'}
                    className={styles.image}
                    width={w}
                    height={h}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </Link>
              ) : (
                <div className={styles.placeholder}>
                  <Text as="span" size="sm">
                    No image
                  </Text>
                </div>
              )}
            </div>
            <div className={styles.info}>
              <Text as="h2" font="sans" size="md" className={styles.artist}>
                {artwork.author || artistName || ''}
              </Text>
              <Text as="h1" font="sans" size="lg" className={styles.title}>
                <em>{artwork.title || artwork.name}</em>
                {artwork.year && <span>, {artwork.year}</span>}
              </Text>
              {artwork.technique && (
                <RichText content={artwork.technique} variant="compact" className={styles.detail} />
              )}
              {/* The work's own dimensions — shown on every grid, /prints
                  included. They describe the ORIGINAL, not the sheet the buyer
                  receives; the sheet is chosen in the wizard. */}
              {artwork.dimensions && (
                <Text as="p" size="sm" className={styles.detail}>
                  {artwork.dimensions}
                </Text>
              )}
              {sale && (
                <div className={styles.orderAction}>
                  <Text as="span" className={styles.editionTag}>
                    {sale.editionType === 'limited' ? 'Limited Edition' : 'Open Edition'}
                  </Text>
                  {/* `null` = nothing left to buy, and that is the one number
                      the card still speaks. The work STAYS on the page and says
                      so: a sold-out edition is the best thing there, while an
                      "Order Print" button leading to a wizard that refuses the
                      sale is the worst.
                      The price itself is gated above — see
                      SHOW_PRICE_ON_LISTINGS. */}
                  {sale.minPriceCents != null ? (
                    <>
                      {SHOW_PRICE_ON_LISTINGS && (
                        <Text as="span" className={styles.price}>
                          {formatEuros(sale.minPriceCents)}
                        </Text>
                      )}
                      <Button
                        href={`/artworks/${artwork.slug}/print`}
                        label="Order Print"
                        variant="primary"
                        size="regularSquared"
                      />
                    </>
                  ) : (
                    <Text as="span" className={styles.soldOut}>
                      Sold out
                    </Text>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
