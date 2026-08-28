'use client'

import { Icon } from '@/components/ui/Icon'
import { formatDualDimensions, formatEuro } from '@/lib/print-providers'
import { TPS_PAPERS, TPS_PRINT_TYPES } from '@/lib/print-providers/printspace'
import { isFixedSheet } from '@/lib/editions/sheetLayout'
import type { LimitedVariantView } from '@/lib/editions/types'

import styles from './PrintWizard.module.scss'

export type VariantPickerItem = LimitedVariantView & { priceCents: number }

type Props = {
  variants: VariantPickerItem[]
  /** Currently selected id — empty string before the buyer has chosen. */
  selectedVariantId: string
  onSelect: (id: string) => void
  /** Ids of this artwork's variants already in the cart — marked, not locked. */
  cartedVariantIds?: ReadonlySet<string>
}

/**
 * Left-column selector for a limited edition: the buyer picks from the
 * artwork's pre-defined variants — no size/paper/framing configuration.
 *
 * A SOLD-OUT variant still appears, disabled and tagged. Removing it made the
 * edition look smaller than it is and hid the most persuasive fact the page
 * has: that a size sold out. Scarcity is the point of a limited edition, so an
 * empty row earns its place.
 *
 * One edition at a time, and none on arrival: the measurement diagram and the
 * spec list both describe exactly one print, and choosing for the buyer on
 * entry would both pre-empt the decision and aim the CTA at an edition nobody
 * asked for. Picking another switches; clicking the selected one does nothing,
 * since deselecting back to an empty panel is not a move anyone wants.
 *
 * EVERY card stays clickable, including one whose edition is already in the
 * cart. Selecting is how an edition gets drawn in the measurement diagram,
 * and owning a copy is no reason to lose the ability to look at it. A carted
 * card is marked with an "In your cart" tag and loses only the add — the panel
 * prices it at nothing and the CTA skips it.
 */
export const VariantPicker = ({
  variants,
  selectedVariantId,
  onSelect,
  cartedVariantIds,
}: Props) => (
  <div className={styles.variantPicker}>
    <h2 className={styles.variantPickerTitle}>Choose your edition</h2>
    {variants.map((v) => {
      const paperLabel = TPS_PAPERS.find((p) => p.id === v.paperId)?.label ?? v.paperId
      const techniqueLabel = TPS_PRINT_TYPES.find((t) => t.id === v.printTypeId)?.label
      // White Cube–style medium line: "<technique> print on <paper>".
      const medium = techniqueLabel ? `${techniqueLabel} print on ${paperLabel}` : paperLabel
      const soldOut = v.remaining <= 0
      const inCart = !soldOut && (cartedVariantIds?.has(v.id) ?? false)
      const selected = v.id === selectedVariantId
      return (
        <button
          key={v.id}
          type="button"
          className={`${styles.variantCard} ${selected ? styles.variantCardSelected : ''} ${
            inCart || soldOut ? styles.variantCardInCart : ''
          } ${soldOut ? styles.variantCardSoldOut : ''}`}
          onClick={() => onSelect(v.id)}
          // Sold out is the one state that genuinely cannot be selected: there
          // is nothing to buy and nothing to preview buying. A carted variant
          // stays live by contrast — see the note above.
          disabled={soldOut}
          aria-pressed={selected}
        >
          <span className={styles.variantCardHead}>
            <span className={styles.variantCardEyebrow}>Edition name</span>
            {soldOut && <span className={styles.variantCardTag}>Sold out</span>}
            {inCart && (
              <span className={styles.variantCardTag}>
                <Icon name="check-circle" size={13} />
                In your cart
              </span>
            )}
          </span>
          <span className={styles.variantCardName}>{v.name}</span>
          <span className={styles.variantCardMeta}>{medium}</span>
          <span className={styles.variantCardMeta}>
            {/* "sheet" and "print" are the two words for the two measurements,
                matching the summary panel's "Print size" row — the card used to
                call the same figure the "image" while the panel called it the
                print. "Unframed" is gone with them: the panel states the
                framing, and every limited variant is print-only anyway, so it
                was a constant on every card. */}
            {isFixedSheet(v)
              ? `${formatDualDimensions(v.sheetWidthCm as number, v.sheetHeightCm as number)} sheet · ${formatDualDimensions(v.widthCm, v.heightCm)} print`
              : `${formatDualDimensions(v.widthCm, v.heightCm)} print`}
          </span>
          <span className={styles.variantCardStock}>Edition of {v.editionSize}</span>
          <span className={styles.variantCardPrice}>{formatEuro(v.priceCents)}</span>
        </button>
      )
    })}
  </div>
)
