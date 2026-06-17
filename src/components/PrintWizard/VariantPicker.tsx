'use client'

import { formatDualDimensions, formatEuro } from '@/lib/print-providers'
import { TPS_PAPERS } from '@/lib/print-providers/printspace'
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
      const selected = v.id === selectedVariantId
      return (
        <button
          key={v.id}
          type="button"
          className={`${styles.variantCard} ${selected ? styles.variantCardSelected : ''}`}
          onClick={() => onSelect(v.id)}
          aria-pressed={selected}
        >
          <span className={styles.variantCardName}>{v.name}</span>
          <span className={styles.variantCardMeta}>
            {formatDualDimensions(v.widthCm, v.heightCm)}
          </span>
          <span className={styles.variantCardMeta}>{paperLabel}</span>
          <span className={styles.variantCardStock}>
            {v.remaining} of {v.editionSize} available
          </span>
          <span className={styles.variantCardPrice}>{formatEuro(v.priceCents)}</span>
        </button>
      )
    })}
  </div>
)
