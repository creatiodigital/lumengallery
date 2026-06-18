'use client'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

import styles from './PrintWizard.module.scss'

type Props = {
  editionType: 'open' | 'limited'
  /** Opens the edition-details modal. */
  onDetails: () => void
}

/**
 * Persistent edition marker shown at all times above the wizard's left panel,
 * so the buyer always knows whether the artwork is a limited or open edition.
 * The details modal is opened ONLY on demand via "Learn More" (no auto-show).
 */
export const EditionBadge = ({ editionType, onDetails }: Props) => (
  <div className={styles.editionBadge}>
    <Text as="span" font="sans" size="lg" className={styles.editionBadgeLabel}>
      {editionType === 'limited' ? 'Limited Edition' : 'Open Edition'}
    </Text>
    <Button variant="primary" size="smallSquared" label="Learn More" onClick={onDetails} />
  </div>
)
