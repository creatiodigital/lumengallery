import Link from 'next/link'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import type { GallerySelectionCard } from '@/lib/queries/getGallerySelection'

import { PrintsBanner } from './PrintsBanner'
import { PrintsSelection } from './PrintsSelection'
import styles from './prints.module.scss'
import type { PrintsPageContent } from './types'

interface PrintsPageProps {
  /** The gallery's selection, already ordered and already filtered to what a
   *  buyer can complete. Empty is a legitimate state, not an error. */
  selection: GallerySelectionCard[]
  pageContent: PrintsPageContent | null
}

export const PrintsPage = ({ selection, pageContent }: PrintsPageProps) => {
  const hasDescription =
    !!pageContent?.content && pageContent.content.trim() !== '' && pageContent.content !== '<p></p>'

  return (
    <PageLayout>
      {/* Says the quiet part: this page is a choice, not the catalogue. Without
          it a buyer reads the grid as everything for sale and never looks for
          the print on an exhibition or artist page — where most of them live.
          "can also be ordered" rather than "every work is available": print
          enablement is per-artwork, and a blanket promise here would be one the
          exhibition pages can't keep. */}
      <PageHeader
        pageTitle="Prints"
        pageSubtitle="A curated selection. Prints can also be ordered directly from any exhibition or artist page."
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

      {selection.length === 0 ? (
        /* A legitimate state — nothing selected yet, or everything selected has
           gone quiet. The page keeps its banner and copy and says so, rather
           than showing a blank grid that reads as broken. The toolbar goes with
           it: filters over nothing, and a cart that can hold nothing bought
           from this page. */
        <Text as="p" className={styles.selectionEmpty}>
          New prints are being selected. In the meantime, every artist&rsquo;s available work is on{' '}
          <Link href="/artists">their own page</Link>.
        </Text>
      ) : (
        <PrintsSelection selection={selection} />
      )}
    </PageLayout>
  )
}
