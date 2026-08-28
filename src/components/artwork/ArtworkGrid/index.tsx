'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { Text } from '@/components/ui/Typography'
import { usePurchasesPaused } from '@/hooks/usePurchasesPaused'
import type { ArtworkSale } from '@/lib/editions/artworkSale'

import styles from './ArtworkGrid.module.scss'

type Artwork = {
  id: string
  slug: string
  name: string
  title?: string | null
  author?: string | null
  /** Artist name already resolved for THIS artwork (author winning over the
   *  account name). /prints spans several artists, so it cannot pass one
   *  fallback down the way a single-artist page can — it carries the name per
   *  card instead. */
  artistName?: string | null
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
  /**
   * The exhibition this grid belongs to, if any. Rides along on every card's
   * link so the artwork page knows which set the visitor is walking and can
   * offer previous/next arrows through it. Absent on /prints and the artist
   * page, where a card is just a card.
   */
  exhibitionSlug?: string
}

// Fallback ratio for legacy artworks uploaded before EXIF capture.
// 4:3 is closer to the average gallery image than 1:1 and avoids the
// jarring shift a square placeholder gives when the real image is wide.
const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 600

export const ArtworkGrid = ({ artworks, artistName, exhibitionSlug }: ArtworkGridProps) => {
  // Admin kill switch. Hides the whole commerce block — price, CTA and the
  // sold-out badge alike — across every grid that uses this component. The
  // wizard and the payment actions still enforce the pause server-side.
  const purchasesPaused = usePurchasesPaused()

  const context = exhibitionSlug ? `?exhibition=${encodeURIComponent(exhibitionSlug)}` : ''

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
                <Link
                  href={`/artworks/${artwork.slug}${context}`}
                  className={styles.viewDetailsLink}
                >
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
                {/* Per-card first: it is the only value that is right on a
                    multi-artist listing. Then the free-text override, then the
                    page-level fallback a single-artist page supplies. */}
                {artwork.artistName || artwork.author || artistName || ''}
              </Text>
              <Text as="h1" font="sans" size="lg" className={styles.title}>
                <em>{artwork.title || artwork.name}</em>
                {artwork.year && <span>, {artwork.year}</span>}
              </Text>
              {sale && (
                <div className={styles.orderAction}>
                  {/* `null` = nothing left to buy, and that is the one number
                      the card still speaks. The work STAYS on the page and says
                      so: a sold-out edition is the best thing there, while an
                      "Order Print" button leading to a wizard that refuses the
                      sale is the worst. */}
                  {sale.minPriceCents != null ? (
                    <>
                      {/* To the artwork page, NEVER straight to the wizard. The
                          artwork page is the single door to checkout: the grid's
                          job is to earn a click, not to close a sale off a
                          thumbnail. */}
                      <Button
                        href={`/artworks/${artwork.slug}${context}`}
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
