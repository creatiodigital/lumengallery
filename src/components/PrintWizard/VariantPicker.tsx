'use client'

import { formatDualDimensions, formatEuro } from '@/lib/print-providers'
import { TPS_PAPERS, TPS_PRINT_TYPES } from '@/lib/print-providers/printspace'
import { isFixedSheet } from '@/lib/editions/sheetLayout'
import type { LimitedVariantView } from '@/lib/editions/types'

import styles from './PrintWizard.module.scss'

export type VariantPickerItem = LimitedVariantView & { priceCents: number }

type Props = {
  variants: VariantPickerItem[]
  selectedVariantId: string
  onSelect: (id: string) => void
}

/**
 * Left-column selector for a limited edition: the buyer picks one of the
 * pre-defined variants — no size/paper/framing configuration. Sold-out
 * variants are filtered out upstream; each card shows the live remaining
 * count to surface scarcity.
 */
export const VariantPicker = ({ variants, selectedVariantId, onSelect }: Props) => (
  <div className={styles.variantPicker}>
    <h2 className={styles.variantPickerTitle}>Choose your edition</h2>
    {variants.map((v) => {
      const paperLabel = TPS_PAPERS.find((p) => p.id === v.paperId)?.label ?? v.paperId
      const techniqueLabel = TPS_PRINT_TYPES.find((t) => t.id === v.printTypeId)?.label
      // White Cube–style medium line: "<technique> print on <paper>".
      const medium = techniqueLabel ? `${techniqueLabel} print on ${paperLabel}` : paperLabel
      const selected = v.id === selectedVariantId
      return (
        <button
          key={v.id}
          type="button"
          className={`${styles.variantCard} ${selected ? styles.variantCardSelected : ''}`}
          onClick={() => onSelect(v.id)}
          aria-pressed={selected}
        >
          <span className={styles.variantCardEyebrow}>Edition name</span>
          <span className={styles.variantCardName}>{v.name}</span>
          <span className={styles.variantCardMeta}>{medium}</span>
          <span className={styles.variantCardMeta}>
            {isFixedSheet(v)
              ? `${formatDualDimensions(v.sheetWidthCm as number, v.sheetHeightCm as number)} sheet · ${formatDualDimensions(v.widthCm, v.heightCm)} image · Unframed`
              : `${formatDualDimensions(v.widthCm, v.heightCm)} · Unframed`}
          </span>
          <span className={styles.variantCardMeta}>Printed by The Print Space</span>
          <span className={styles.variantCardStock}>Edition of {v.editionSize}</span>
          <span className={styles.variantCardPrice}>{formatEuro(v.priceCents)}</span>
        </button>
      )
    })}
  </div>
)
