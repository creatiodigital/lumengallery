'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { isArtworkPurchasable, isEditionSoldOut } from '@/lib/editions/printable'
import { Share } from '@/components/ui/Share'
import { setPrintReturnUrl } from '@/components/checkout/printReturnUrl'
import { usePurchasesPaused } from '@/hooks/usePurchasesPaused'
import { isRichTextEmpty } from '@/lib/textUtils'
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
  printPriceCents?: number | null
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

interface ArtworkDetailBodyProps {
  artwork: Artwork
  artist: Artist
}

/**
 * The artwork-detail body, shared by the standalone /artworks/[slug] page and the
 * in-exhibition ArtworkModal. Renders only the metadata + image + InquireSidebar;
 * the surrounding chrome (page header/footer, or modal overlay/X) is the caller's job.
 */
export const ArtworkDetailBody = ({ artwork, artist }: ArtworkDetailBodyProps) => {
  const router = useRouter()
  const [isInquireOpen, setIsInquireOpen] = useState(false)

  const soldOut = isEditionSoldOut({
    editionType: artwork.editionType ?? 'open',
    liveVariantCount: artwork.liveVariantCount ?? 0,
    availableNumberCount: artwork.availableNumberCount ?? 0,
  })

  // Purchases kill switch (admin dashboard). The hook's cache is shared with
  // the artwork grids, so moving between a listing and a work doesn't re-read.
  const purchasesPaused = usePurchasesPaused()

  const displayTitle = artwork.title || artwork.name || ''
  const displayAuthor = artwork.author || `${artist.name} ${artist.lastName}`.trim()
  const imgWidth = artwork.originalWidth ?? FALLBACK_WIDTH
  const imgHeight = artwork.originalHeight ?? FALLBACK_HEIGHT

  // Canonical artwork URL — identical to the standalone page's URL, built from the slug
  // so it is correct even when opened as a modal over the exhibition route.
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/artworks/${artwork.slug}` : ''

  return (
    <>
      <div className={styles.metadata}>
        {displayAuthor && (
          <Text as="h1" size="2xl" className={styles.artistName}>
            {displayAuthor}
          </Text>
        )}
        {displayTitle && (
          <div className={styles.title}>
            <Text as="span" size="xl" font="serif" className={styles.titleText}>
              {displayTitle}
            </Text>
            {artwork.year && (
              <Text as="span" size="xl" font="serif" className={styles.year}>
                , {artwork.year}
              </Text>
            )}
          </div>
        )}
        {artwork.technique && (
          <RichText content={artwork.technique} variant="compact" className={styles.technique} />
        )}
        {artwork.dimensions && (
          <Text as="p" size="sm" className={styles.dimensions}>
            {artwork.dimensions}
          </Text>
        )}
        {!isRichTextEmpty(artwork.description) && (
          <RichText
            content={artwork.description!}
            variant="compact"
            className={styles.description}
          />
        )}
        <Button
          variant="secondary"
          label="Inquire"
          icon="arrowRight"
          size="bigSquared"
          onClick={() => setIsInquireOpen(true)}
          className={styles.inquireButton}
        />
        {/* `isArtworkPurchasable` and not a `printPriceCents` check: a LIMITED
            edition has no artwork-level price, so gating on it hid the button
            on every limited work — buyable, listed on /prints, and with no way
            to buy it from its own page or from inside an exhibition. That is
            the exact failure printable.ts was written to end; this surface was
            missed when the others were fixed. */}
        {/* Sold out is stated, not hidden. The edition is still real and still
            worth seeing — and an "Order Print" button on a sold-out edition
            walks the buyer into a wizard that refuses them. */}
        {!purchasesPaused && soldOut ? (
          <Text as="p" className={styles.soldOut}>
            Sold out
          </Text>
        ) : !purchasesPaused &&
          isArtworkPurchasable({
            printEnabled: !!artwork.printEnabled,
            editionType: artwork.editionType ?? 'open',
            printPriceCents: artwork.printPriceCents ?? null,
            liveVariantCount: artwork.liveVariantCount ?? 0,
          }) ? (
          <Button
            variant="primary"
            label="Order Print"
            icon="arrowRight"
            size="bigSquared"
            onClick={() => {
              // Remember where we came from (exhibition visit URL when opened from the
              // modal, or this artwork page) so the print flow's Close returns here.
              setPrintReturnUrl(artwork.slug, window.location.pathname)
              router.push(`/artworks/${artwork.slug}/print`)
            }}
            className={styles.inquireButton}
          />
        ) : null}
        <Share title={displayTitle || 'Artwork'} url={shareUrl} className={styles.share} />
      </div>

      <div className={styles.imageContainer}>
        {artwork.imageUrl && (
          // Raw <img> (not next/image): reuses the image the 3D scene already cached, and
          // sidesteps the known next/image + R2 prod issue. crossOrigin matches THREE's
          // texture request so the same browser-cache entry is reused.
          <img
            src={artwork.imageUrl}
            alt={displayTitle || 'Artwork'}
            width={imgWidth}
            height={imgHeight}
            className={styles.image}
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
