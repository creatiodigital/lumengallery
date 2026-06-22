import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'

import { PrintsBanner } from './PrintsBanner'
import { PrintsBrowser } from './PrintsBrowser'
import styles from './prints.module.scss'
import type { PrintArtistOption, PrintArtwork, PrintsPageContent } from './types'

interface PrintsPageProps {
  /** SSR'd first page of the catalog. */
  initialItems: PrintArtwork[]
  /** Total print-enabled, published works (unfiltered) — drives the empty + page count. */
  initialTotal: number
  /** Distinct artists with prints, for the filter dropdown. */
  artistOptions: PrintArtistOption[]
  pageContent: PrintsPageContent | null
}

export const PrintsPage = ({
  initialItems,
  initialTotal,
  artistOptions,
  pageContent,
}: PrintsPageProps) => {
  const hasDescription =
    !!pageContent?.content && pageContent.content.trim() !== '' && pageContent.content !== '<p></p>'

  return (
    <PageLayout>
      <PageHeader
        pageTitle="Prints"
        pageSubtitle="Museum-grade prints of selected works, in open and limited editions."
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

      {initialTotal === 0 ? (
        <EmptyState message="Very soon we will showcase a selection of works as signed, limited-edition prints — produced on archival, gallery-grade paper and shipped worldwide." />
      ) : (
        <PrintsBrowser
          initialItems={initialItems}
          initialTotal={initialTotal}
          artistOptions={artistOptions}
        />
      )}
    </PageLayout>
  )
}
