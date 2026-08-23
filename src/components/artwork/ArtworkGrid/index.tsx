'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
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
  /** 'open' | 'limited' — drives the edition tag shown with the Order Print CTA. */
  editionType?: string | null
  imageUrl?: string | null
  // Real pixel dimensions when known. Used per-tile so next/image
  // reserves the correct slot — fixes CLS without forcing a square crop.
  originalWidth?: number | null
  originalHeight?: number | null
  /** Cheapest completable purchase, in cents, excluding shipping and tax.
   *  Null = nothing purchasable, shown as "Sold". Only supplied by the prints
   *  catalog; other grids leave it undefined and render no price. */
  minPriceCents?: number | null
}

interface ArtworkGridProps {
  artworks: Artwork[]
  artistName?: string
  /** Show an "Order Print" CTA per card (the prints page). Off elsewhere. */
  withOrderPrint?: boolean
}

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

export const ArtworkGrid = ({ artworks, artistName, withOrderPrint = false }: ArtworkGridProps) => {
  return (
    <div className={styles.grid}>
      {artworks.map((artwork) => {
        const w = artwork.originalWidth ?? FALLBACK_WIDTH
        const h = artwork.originalHeight ?? FALLBACK_HEIGHT
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
              {/* The work's own dimensions. Deliberately absent from a prints
                  card: the sheet the buyer receives comes in several sizes, so
                  the painting's 40x50 there reads as a print size and isn't
                  one. It stays on the artist and exhibition grids, where it
                  describes the actual object. */}
              {!withOrderPrint && artwork.dimensions && (
                <Text as="p" size="sm" className={styles.detail}>
                  {artwork.dimensions}
                </Text>
              )}
              {withOrderPrint && (
                <div className={styles.orderAction}>
                  <Text as="span" className={styles.editionTag}>
                    {artwork.editionType === 'limited' ? 'Limited Edition' : 'Open Edition'}
                  </Text>
                  {/* A bare figure, no "from" or "starting at" — a gallery states
                      a price. What it means differs by edition type and the page
                      footnote carries that: a limited variant's price is exact,
                      an open edition's moves with size and framing.
                      `null` = nothing left to buy. The work STAYS in the
                      catalogue and says so: a sold-out edition is the best
                      thing on the page, and an "Order Print" button that leads
                      to a wizard refusing the sale is the worst. */}
                  {artwork.minPriceCents != null ? (
                    <>
                      <Text as="span" className={styles.price}>
                        {formatEuros(artwork.minPriceCents)}
                      </Text>
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
