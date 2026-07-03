'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'

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
              {artwork.dimensions && (
                <Text as="p" size="sm" className={styles.detail}>
                  {artwork.dimensions}
                </Text>
              )}
              {withOrderPrint && (
                <div className={styles.orderAction}>
                  <Text as="span" className={styles.editionTag}>
                    {artwork.editionType === 'limited' ? 'Limited Edition' : 'Open Edition'}
                  </Text>
                  <Button
                    href={`/artworks/${artwork.slug}/print`}
                    label="Order Print"
                    variant="primary"
                    size="regularSquared"
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
