'use client'

import { useState } from 'react'

import c from 'classnames'

import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { Share } from '@/components/ui/Share'
import { usePurchasesPaused } from '@/hooks/usePurchasesPaused'
import type { VariantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { isRichTextEmpty } from '@/lib/textUtils'
import { ArtworkAvailabilityCard } from './ArtworkAvailabilityCard'
import { reportImageError } from '@/lib/observability/reportImageError'

import styles from './ArtworkDetail.module.scss'

export type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
}

export type Artwork = {
  id: string
  slug: string
  name: string
  title?: string | null
  author?: string | null
  year?: string | null
  technique?: string | null
  dimensions?: string | null
  description?: string | null
  imageUrl?: string | null
  originalWidth?: number | null
  originalHeight?: number | null
  printEnabled?: boolean | null
  /** 'open' | 'limited'. Absent = treated as open, which is the pre-limited
   *  behaviour: purchasability falls back to the artwork-level price. */
  editionType?: string | null
  /** Variants matching LIVE_VARIANT_WHERE. The ONLY thing that makes a limited
   *  edition buyable — it carries no artwork-level price. */
  liveVariantCount?: number | null
  /** EditionNumbers still available across those variants. 0 with live variants
   *  present = sold out, which is a different thing from unpurchasable. */
  availableNumberCount?: number | null
}

const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 800

/**
 * Resolved commerce facts for the availability card.
 *
 * Present ONLY on the standalone artwork page. The in-exhibition modal omits it
 * and keeps its existing inline CTA: a priced card, a caveat and a variant list
 * belong on a page, not in a small overlay floating over a 3D room.
 */
/** One side of the previous/next pair — a URL and the work it leads to. */
export type ArtworkNeighbour = {
  href: string
  title: string
}

/** The neighbouring works in the set the visitor is walking, if any. */
export type ArtworkNeighbours = {
  prev: ArtworkNeighbour | null
  next: ArtworkNeighbour | null
}

export type ArtworkCommerce = {
  editionType: 'open' | 'limited'
  minPriceCents: number | null
  /** Every live edition of this work, priced per row. */
  editionLines: VariantEditionLineParts[]
}

interface ArtworkDetailBodyProps {
  artwork: Artwork
  artist: Artist
  commerce?: ArtworkCommerce | null
  /** `page` moves the story and the commerce band out to full-width sections
   *  below the image. `modal` keeps everything in the metadata column, which is
   *  all an overlay over a 3D room can hold. */
  layout?: 'page' | 'modal'
  /**
   * Previous/next in the set the visitor came from. Plain links — following one
   * is an ordinary navigation to that artwork's URL, not a carousel. Absent
   * when there is no set, which is the common case.
   */
  neighbours?: ArtworkNeighbours | null
}

/**
 * The artwork-detail body, shared by the standalone /artworks/[slug] page and the
 * in-exhibition ArtworkModal. Renders only the metadata + image + InquireSidebar;
 * the surrounding chrome (page header/footer, or modal overlay/X) is the caller's job.
 */
export const ArtworkDetailBody = ({
  artwork,
  artist,
  commerce,
  layout = 'modal',
  neighbours,
}: ArtworkDetailBodyProps) => {
  const [isInquireOpen, setIsInquireOpen] = useState(false)

  // Purchases kill switch (admin dashboard). The hook's cache is shared with
  // the artwork grids, so moving between a listing and a work doesn't re-read.
  const purchasesPaused = usePurchasesPaused()

  const displayTitle = artwork.title || artwork.name || ''
  const displayAuthor = artwork.author || `${artist.name} ${artist.lastName}`.trim()
  const imgWidth = artwork.originalWidth ?? FALLBACK_WIDTH
  const imgHeight = artwork.originalHeight ?? FALLBACK_HEIGHT
  // Which dimension drives the image's size on the two-column layout. The
  // threshold is 0.8 rather than 1.0 on purpose: a square work at the column's
  // full width is just as tall as a portrait one, so it belongs on the
  // height-driven rule too. Only clearly wide work stays width-driven.
  const isTallFormat = imgHeight / imgWidth > 0.8

  // Canonical artwork URL — identical to the standalone page's URL, built from the slug
  // so it is correct even when opened as a modal over the exhibition route.
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/artworks/${artwork.slug}` : ''

  return (
    <>
      <div className={styles.metadata}>
        {/* The work leads, and it is the <h1>: this page is about the artwork,
            not about the artist, who has a page of their own. */}
        {displayTitle && (
          <h1 className={styles.title}>
            <Text as="span" size="3xl" font="serif" className={styles.titleText}>
              {displayTitle}
            </Text>
          </h1>
        )}
        {displayAuthor && (
          <Text as="p" size="xl" font="serif" className={styles.artistName}>
            {displayAuthor}
          </Text>
        )}
        {artwork.technique && (
          <RichText content={artwork.technique} variant="compact" className={styles.technique} />
        )}
        {artwork.dimensions && (
          <Text as="p" size="sm" className={styles.dimensions}>
            {artwork.dimensions}
          </Text>
        )}
        {layout === 'modal' && !isRichTextEmpty(artwork.description) && (
          <RichText
            content={artwork.description!}
            variant="compact"
            className={styles.description}
          />
        )}
        {commerce && !purchasesPaused && (
          <ArtworkAvailabilityCard
            editionType={commerce.editionType}
            minPriceCents={commerce.minPriceCents}
            editionLines={commerce.editionLines}
            artworkSlug={artwork.slug}
          />
        )}
        {/* Below the purchase block: once a work is buyable, enquiring is the
            secondary path. On a piece that is NOT for sale there is no card
            above it and this is the only route forward. */}
        <Button
          variant="secondary"
          label="Inquire"
          icon="arrowRight"
          size="bigSquared"
          onClick={() => setIsInquireOpen(true)}
          className={`${styles.inquireButton} ${styles.inquireButtonFull}`}
        />
        <Share title={displayTitle || 'Artwork'} url={shareUrl} className={styles.share} />
      </div>

      <div className={styles.imageContainer}>
        {/* Arrows are laid out BESIDE the picture, not pinned to the column's
            edges: a portrait work leaves most of the column empty, and an arrow
            at the far edge floated in the middle of nowhere. As flex siblings
            of the frame they sit against the picture whatever its shape.

            When a side has no neighbour it keeps its width as an empty slot, so
            the work stays on the same axis from the first piece in a show to
            the last instead of jumping sideways at each end. */}
        {neighbours &&
          (neighbours.prev ? (
            <Button
              variant="bare"
              icon="arrowLeft"
              href={neighbours.prev.href}
              className={styles.navArrow}
              title={neighbours.prev.title}
              aria-label={`Previous work: ${neighbours.prev.title}`}
            />
          ) : (
            <span className={styles.navArrowSlot} aria-hidden="true" />
          ))}

        <div className={styles.imageFrame}>
          {artwork.imageUrl && (
            // Raw <img> (not next/image): reuses the image the 3D scene already cached, and
            // sidesteps the known next/image + R2 prod issue. crossOrigin matches THREE's
            // texture request so the same browser-cache entry is reused.
            <img
              src={artwork.imageUrl}
              alt={displayTitle || 'Artwork'}
              width={imgWidth}
              height={imgHeight}
              className={c(styles.image, isTallFormat && styles.imagePortrait)}
              crossOrigin="anonymous"
              decoding="async"
              onError={() =>
                reportImageError(artwork.imageUrl, {
                  surface: 'artwork-detail',
                  alt: displayTitle || undefined,
                })
              }
            />
          )}
        </div>

        {neighbours &&
          (neighbours.next ? (
            <Button
              variant="bare"
              icon="arrowRight"
              href={neighbours.next.href}
              className={styles.navArrow}
              title={neighbours.next.title}
              aria-label={`Next work: ${neighbours.next.title}`}
            />
          ) : (
            <span className={styles.navArrowSlot} aria-hidden="true" />
          ))}
      </div>

      <InquireSidebar
        isOpen={isInquireOpen}
        onClose={() => setIsInquireOpen(false)}
        artwork={{
          slug: artwork.slug,
          title: displayTitle || '',
          year: artwork.year ? parseInt(artwork.year, 10) : undefined,
          artistName: displayAuthor || '',
          imageUrl: artwork.imageUrl || '',
        }}
      />
    </>
  )
}
