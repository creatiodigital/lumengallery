import { PageLayout } from '@/components/ui/PageLayout'

import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'

import { ArtworkMediaGallery } from './ArtworkMediaGallery'
import { ArtworkStorySection } from './ArtworkStorySection'

import {
  ArtworkDetailBody,
  type Artwork,
  type Artist,
  type ArtworkCommerce,
  type ArtworkNeighbours,
} from './ArtworkDetailBody'
import styles from './ArtworkDetail.module.scss'

interface ArtworkDetailPageProps {
  artwork: Artwork
  artist: Artist
  commerce?: ArtworkCommerce | null
  /** Admin-edited purchase notes for this edition type. Absent = no copy. */
  /** Supplementary imagery. Empty for most works, and that is the normal case. */
  media?: ArtworkMediaItem[]
  /** Previous/next in the exhibition the visitor came from, when they did. */
  neighbours?: ArtworkNeighbours | null
}

export const ArtworkDetailPage = ({
  artwork,
  artist,
  commerce,
  media = [],
  neighbours,
}: ArtworkDetailPageProps) => {
  return (
    <PageLayout>
      {/* The two-column zone. Everything below it is full width, so it lives
          outside this grid rather than as another cell in it. */}
      <div className={styles.standaloneContent}>
        <ArtworkDetailBody
          artwork={artwork}
          artist={artist}
          commerce={commerce}
          layout="page"
          neighbours={neighbours}
        />
      </div>

      <ArtworkStorySection description={artwork.description} />

      <ArtworkMediaGallery media={media} />
    </PageLayout>
  )
}
