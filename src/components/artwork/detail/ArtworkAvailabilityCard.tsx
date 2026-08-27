'use client'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { formatDisplayPrice } from '@/lib/editions/formatDisplayPrice'
import type { VariantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { usePrintWizard } from './usePrintWizard'

import styles from './ArtworkAvailabilityCard.module.scss'

/**
 * The compact commerce block in the artwork page's left column.
 *
 * It has to clear the fold on a laptop, so it says only what a buyer needs in
 * order to decide: the price, the copy they would receive, the single caveat
 * that matters, and the button. The fuller explanation — the whole variant
 * list, the purchase notes — lives in the band further down the page.
 *
 * It describes exactly ONE configuration: the cheapest live variant, which is
 * the one `minimumPrice` costed. Pairing that figure with, say, a range of
 * edition sizes would let the price and the edition describe different objects.
 *
 * Rendered only when the work is actually for sale — a piece that is not for
 * sale shows no trace of commerce, not an empty card.
 */
type ArtworkAvailabilityCardProps = {
  editionType: 'open' | 'limited'
  /** Cheapest completable purchase. `null` means live but sold out. */
  minPriceCents: number | null
  /** EVERY live edition, not just the one the price was costed from. The button
   *  opens a picker showing all of them, so a card naming one would promise an
   *  edition the next screen does not single out. The variant name arrives
   *  separately so it can be set in bold: it is the part a reader scans for,
   *  and the only part that differs between rows. */
  editionLines?: VariantEditionLineParts[]
  artworkSlug: string
}

export const ArtworkAvailabilityCard = ({
  editionType,
  minPriceCents,
  editionLines = [],
  artworkSlug,
}: ArtworkAvailabilityCardProps) => {
  const openWizard = usePrintWizard(artworkSlug)
  const soldOut = minPriceCents === null
  const isLimited = editionType === 'limited'

  return (
    <div className={styles.card}>
      <Text as="p" className={soldOut ? styles.eyebrowSoldOut : styles.eyebrow}>
        {soldOut ? 'Sold out' : 'Available for purchase'}
      </Text>

      {/* Its own line, under the eyebrow. It describes the WORK, not any one
          edition of it, so it does not belong beside a single price. */}
      <Text as="p" className={styles.editionType}>
        {isLimited ? 'Limited Edition' : 'Open Edition'}
      </Text>

      {/* An open edition has no variants to enumerate, so its single figure
          stands alone. A limited edition prices each row instead — the price is
          not common across a work's editions. */}
      {editionLines.length === 0 && minPriceCents !== null && (
        <Text as="p" font="serif" className={styles.price}>
          {formatDisplayPrice(minPriceCents)}
        </Text>
      )}

      {/* All of them. A sold-out edition stays listed and says so — it is still
          real, and dropping it would read as if it never existed. */}
      {editionLines.length > 0 && (
        <ul className={styles.editions}>
          {editionLines.map((line) => (
            <li key={`${line.name}-${line.count}`} className={styles.editionLine}>
              <Text as="span" font="serif" className={styles.rowPrice}>
                {line.price ?? ''}
              </Text>
              <Text as="span" className={styles.rowEdition}>
                <strong className={styles.editionName}>{line.name}</strong>
                <span className={styles.rowDivider}>|</span>
                {line.count}
              </Text>
            </li>
          ))}
        </ul>
      )}

      {/* Common to every edition on the work, so it sits below the list rather
          than attached to any one row. Limited only: on an open edition nothing
          can be taken first and the sentence would simply be untrue. Editions
          are deliberately NOT held before payment — this line is the whole
          mitigation, and saying it plainly is what keeps a lost race from
          feeling like a trick. */}
      {isLimited && !soldOut && (
        <Text as="p" size="sm" className={styles.caveat}>
          Not reserved until you pay &mdash; another collector may take it first.
        </Text>
      )}

      {!soldOut && (
        <Button
          variant="primary"
          label="Order a print"
          icon="arrowRight"
          size="bigSquared"
          onClick={openWizard}
          className={styles.cta}
        />
      )}
    </div>
  )
}
