'use client'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import OrnamentRule from '@/icons/ornament-rule.svg'

import styles from './PrintWizard.module.scss'

type Props = {
  editionType: 'open' | 'limited'
  /** Opens the edition-details modal. */
  onDetails: () => void
  /** Optional line under the badge — the limited path's availability caveat.
   *  Rendered HERE rather than beside the badge in the wizard because
   *  `.body` is a three-column grid: a sibling would take a cell and displace
   *  the picker, preview and summary. The badge already spans the full first
   *  row, so anything that belongs to it goes inside it. */
  note?: string
}

/**
 * Persistent edition marker shown at all times above the wizard's left panel,
 * so the buyer always knows whether the artwork is a limited or open edition.
 * The details modal is opened ONLY on demand via "Learn more" (no auto-show).
 * Deliberately quiet: a bordered badge with a soft text link below — the
 * modal is supporting information, not a step in the purchase.
 */
export const EditionBadge = ({ editionType, onDetails, note }: Props) => (
  <div className={styles.editionBadge}>
    <span className={styles.editionBadgeLabel}>
      <OrnamentRule className={styles.editionBadgeOrnament} aria-hidden="true" />
      <Text as="span" font="serif" size="sm" className={styles.editionBadgeText}>
        {editionType === 'limited' ? 'Limited Edition' : 'Open Edition'}
      </Text>
      <OrnamentRule className={styles.editionBadgeOrnament} aria-hidden="true" />
    </span>
    <Button
      variant="ghost"
      size="small"
      label="Learn more"
      onClick={onDetails}
      className={styles.editionBadgeCta}
    />
    {note && (
      <Text as="p" size="sm" className={styles.editionBadgeNote}>
        {note}
      </Text>
    )}
  </div>
)
