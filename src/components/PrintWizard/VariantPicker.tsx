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
 * Sold-out variants are filtered out upstream; each card shows the live
 * remaining count to surface scarcity.
 *
 * One edition at a time, and none on arrival: the preview, the size schema and
 * the spec list all describe exactly one print, and choosing for the buyer on
 * entry would both pre-empt the decision and aim the CTA at an edition nobody
 * asked for. Picking another switches; clicking the selected one does nothing,
 * since deselecting back to an empty panel is not a move anyone wants.
 *
 * EVERY card stays clickable, including one whose edition is already in the
 * cart. Selecting is how an edition gets hung on the wall in the 3D preview,
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
      const inCart = cartedVariantIds?.has(v.id) ?? false
      const selected = v.id === selectedVariantId
      return (
        <button
          key={v.id}
          type="button"
          className={`${styles.variantCard} ${selected ? styles.variantCardSelected : ''} ${
            inCart ? styles.variantCardInCart : ''
          }`}
          onClick={() => onSelect(v.id)}
          aria-pressed={selected}
        >
          <span className={styles.variantCardHead}>
            <span className={styles.variantCardEyebrow}>Edition name</span>
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
