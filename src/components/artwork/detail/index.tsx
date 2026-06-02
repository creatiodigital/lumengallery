import { PageLayout } from '@/components/ui/PageLayout'

import { ArtworkDetailBody, type Artwork, type Artist } from './ArtworkDetailBody'
import styles from './ArtworkDetail.module.scss'

interface ArtworkDetailPageProps {
  artwork: Artwork
  artist: Artist
}

export const ArtworkDetailPage = ({ artwork, artist }: ArtworkDetailPageProps) => {
  return (
    <PageLayout>
      <div className={styles.standaloneContent}>
        <ArtworkDetailBody artwork={artwork} artist={artist} />
      </div>
    </PageLayout>
  )
}
