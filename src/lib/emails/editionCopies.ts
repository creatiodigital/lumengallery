import { escapeHtml } from '@/utils/escapeHtml'
import { emailDetailRows, emailEyebrow } from './components'

/**
 * How a buyer is told WHICH copy of a limited edition is theirs.
 *
 * The number is allocated at payment but deliberately withheld until
 * production starts — before that an order can be cancelled or refunded and
 * the number returned to the pool, so naming it would promise a copy we might
 * not deliver (see EDITION_NUMBER_NOTICE_BODY). From production onward it is
 * committed, so the in-production, shipped and delivered emails all name it.
 *
 * They repeat it on purpose. Until the parcel arrives these emails are the
 * buyer's only record of the fact; afterwards the print carries it in its own
 * margin. Formatting lives here, in one place, so the three emails cannot
 * drift apart.
 */

/** One numbered limited-edition copy on the order. Open-edition lines have no
 *  number, so they never appear here. */
export type EditionAssignment = {
  artworkTitle: string
  number: number
  editionSize: number
}

/** "No. 3 of 45" — the single canonical rendering of a copy number. */
export function formatEditionCopy(edition: EditionAssignment): string {
  return `No. ${edition.number} of ${edition.editionSize}`
}

/**
 * The `Edition` row for an order's detail block. Present only when the order
 * holds exactly ONE numbered copy — with several, a single row cannot say
 * which number belongs to which print, so they go in `editionsListBlock`
 * instead. Open editions get nothing.
 */
export function editionDetailRows(
  editions: EditionAssignment[],
): Array<{ label: string; value: string }> {
  return editions.length === 1 ? [{ label: 'Edition', value: formatEditionCopy(editions[0]) }] : []
}

/**
 * A labelled list of every numbered copy, for carts holding more than one.
 * Empty string for none or one — those are covered by `editionDetailRows`.
 */
export function editionsListBlock(editions: EditionAssignment[]): string {
  if (editions.length < 2) return ''
  return (
    emailEyebrow('Your editions') +
    emailDetailRows(
      editions.map((e) => ({
        label: escapeHtml(e.artworkTitle) || 'Print',
        value: formatEditionCopy(e),
      })),
    )
  )
}
