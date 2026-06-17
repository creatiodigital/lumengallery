import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'

import { PrintsBanner } from './PrintsBanner'
import { PrintsBrowser } from './PrintsBrowser'
import styles from './prints.module.scss'
import type { PrintArtwork, PrintsPageContent } from './types'

interface PrintsPageProps {
  artworks: PrintArtwork[]
  pageContent: PrintsPageContent | null
}

export const PrintsPage = ({ artworks, pageContent }: PrintsPageProps) => {
  const sorted = [...artworks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const hasDescription =
    !!pageContent?.content && pageContent.content.trim() !== '' && pageContent.content !== '<p></p>'

  return (
    <PageLayout>
      <PageHeader
        pageTitle="Prints"
        pageSubtitle="Museum-grade prints of selected works, hand-signed by the artist."
      />

      <div className={styles.intro}>
        <PrintsBanner
          imageUrl={pageContent?.bannerImageUrl ?? null}
          alt={pageContent?.title || 'Fine Art Prints'}
        />
        <div className={styles.description}>
          <Text as="h2" font="serif" size="3xl" className={styles.descriptionTitle}>
            Fine Art Prints
          </Text>
          {hasDescription && <RichText content={pageContent!.content} />}
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState message="Very soon we will showcase a selection of works as signed, limited-edition prints — produced on archival, gallery-grade paper and shipped worldwide." />
      ) : (
        <PrintsBrowser artworks={sorted} />
      )}
    </PageLayout>
  )
}
