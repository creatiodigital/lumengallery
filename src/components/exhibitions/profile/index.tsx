'use client'

import Image from 'next/image'
import Link from 'next/link'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Share } from '@/components/ui/Share'
import { Text } from '@/components/ui/Typography'
import { isRichTextEmpty } from '@/lib/textUtils'
import { isSafeImageSrc } from '@/lib/imageSafety'
import type { PublicExhibition } from '@/lib/queries/getPublicExhibitionByUrl'

import { EnterExhibitionButton } from './EnterExhibitionButton'
import styles from './ExhibitionProfile.module.scss'

interface ExhibitionProfilePageProps {
  artistSlug: string
  exhibitionSlug: string
  exhibition: PublicExhibition
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'

export const ExhibitionProfilePage = ({
  artistSlug,
  exhibitionSlug,
  exhibition,
}: ExhibitionProfilePageProps) => {
  const shareUrl = `${SITE_URL}/exhibitions/${artistSlug}/${exhibitionSlug}`
  const visitUrl = `/exhibitions/${artistSlug}/${exhibitionSlug}/visit`
  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`

  const formatDate = (date: Date | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const startDate = formatDate(exhibition.startDate)
  const endDate = formatDate(exhibition.endDate)
  const dateRange =
    startDate && endDate ? `${startDate} – ${endDate}` : startDate || endDate || null

  return (
    <PageLayout>
      <div className={styles.content}>
        <div className={styles.heroSection}>
          <div className={styles.heroCta}>
            <Text as="h1" size="3xl" className={styles.title}>
              {exhibition.mainTitle}
            </Text>
            <Link href={`/artists/${exhibition.user.handler}`} className={styles.artist}>
              {artistName}
            </Link>
            <EnterExhibitionButton
              artistSlug={artistSlug}
              exhibitionSlug={exhibitionSlug}
              visitUrl={visitUrl}
              className={styles.button}
            />
            <Share
              title={`${exhibition.mainTitle} — ${artistName}`}
              url={shareUrl}
              className={styles.share}
            />
          </div>

          {exhibition.featuredImageUrl && isSafeImageSrc(exhibition.featuredImageUrl) && (
            <div className={styles.heroImageWrapper}>
              <Image
                src={exhibition.featuredImageUrl}
                alt={exhibition.mainTitle}
                fill
                priority
                // Skip the Vercel /_next/image optimizer: the source is an
                // already-optimized .webp on an immutable R2/CDN. Re-encoding it
                // on a cold transform is what made images break on first load
                // and only show after a refresh (AR-125).
                unoptimized
                sizes="(max-width: 768px) 100vw, 66vw"
                className={styles.heroImage}
              />
            </div>
          )}
        </div>

        {dateRange && (
          <Text as="p" className={styles.dates}>
            {dateRange}
          </Text>
        )}

        {!isRichTextEmpty(exhibition.description) && (
          <RichText content={exhibition.description!} className={styles.description} />
        )}

        {exhibition.artworks.length > 0 && (
          <div className={styles.artworksSection}>
            {/* The slug rides along on every card link, so the artwork page
                can offer arrows through THIS exhibition's sequence. */}
            <ArtworkGrid
              artworks={exhibition.artworks}
              artistName={artistName}
              exhibitionSlug={exhibitionSlug}
            />
          </div>
        )}
      </div>
    </PageLayout>
  )
}
