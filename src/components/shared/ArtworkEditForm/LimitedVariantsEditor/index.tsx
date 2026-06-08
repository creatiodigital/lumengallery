'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'
import { CustomSizeInputs } from '@/components/PrintWizard/CustomSizeInputs'

import { LIMITED_BORDER_MIN_CM, MAX_LIMITED_VARIANTS } from '@/lib/editions/validateVariant'
import type { LimitedVariantDraft } from '@/lib/editions/types'
import { TPS_PAPERS, TPS_SIZE_BOUNDS } from '@/lib/print-providers/printspace'
import type { PrintLongEdgeBounds } from '@/lib/print-providers/printspace'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import styles from './LimitedVariantsEditor.module.scss'

const PAPER_OPTIONS: SelectOption[] = TPS_PAPERS.map((p) => ({ value: p.id, label: p.label }))

// Aspect-locked custom-size bounds for a variant — identical clamps to the
// buyer wizard (same TPS limits, aspect locked to the artwork).
const SIZE_CUSTOM = {
  minCm: TPS_SIZE_BOUNDS.minCm,
  maxCm: TPS_SIZE_BOUNDS.maxCm,
  stepCm: TPS_SIZE_BOUNDS.stepCm,
  aspectLocked: true as const,
}

type Props = {
  variants: LimitedVariantDraft[]
  aspectRatio: number
  longEdgeBounds: PrintLongEdgeBounds | null
  onChange: (next: LimitedVariantDraft[]) => void
  /** When true the whole editor is read-only (artwork locked for sale).
   *  Fields are shown but disabled; no add/remove. */
  locked?: boolean
}

/**
 * Flexible editor for a limited edition's variants: one mandatory variant
 * plus an "Add variant" CTA up to MAX_LIMITED_VARIANTS. No empty rows —
 * the artist only ever sees the variants they've added. Published variants
 * are locked (size + edition size frozen once numbers can sell).
 */
export const LimitedVariantsEditor = ({
  variants,
  aspectRatio,
  longEdgeBounds,
  onChange,
  locked = false,
}: Props) => {
  const update = (index: number, patch: Partial<LimitedVariantDraft>) => {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  const add = () => {
    if (variants.length >= MAX_LIMITED_VARIANTS) return
    onChange([
      ...variants,
      {
        name: '',
        paperId: TPS_PAPERS[0].id,
        widthCm: 0,
        heightCm: 0,
        borderCm: LIMITED_BORDER_MIN_CM,
        editionSize: 50,
      },
    ])
  }

  const remove = (index: number) => {
    onChange(variants.filter((_, i) => i !== index))
  }

  // Duplicate-size detection (TPS keys edition identity on print size).
  const sizeKey = (v: LimitedVariantDraft) => `${v.widthCm}x${v.heightCm}`
  const seen = new Map<string, number>()
  variants.forEach((v) => {
    if (v.widthCm > 0 && v.heightCm > 0) seen.set(sizeKey(v), (seen.get(sizeKey(v)) ?? 0) + 1)
  })

  return (
    <div className={styles.editor}>
      {variants.map((variant, index) => {
        const isMandatory = index === 0
        const rowLocked = locked || variant.published === true
        const duplicateSize =
          variant.widthCm > 0 && variant.heightCm > 0 && (seen.get(sizeKey(variant)) ?? 0) > 1

        return (
          <div key={variant.id ?? `new-${index}`} className={styles.variantCard}>
            <div className={styles.variantHeader}>
              <span className={styles.variantTag}>
                {isMandatory ? 'Variant 1 (required)' : `Variant ${index + 1}`}
                {rowLocked && <span className={styles.lockBadge}>Locked</span>}
              </span>
              {!isMandatory && !rowLocked && (
                <button type="button" className={styles.removeBtn} onClick={() => remove(index)}>
                  Remove
                </button>
              )}
            </div>

            <div className={dashboardStyles.field}>
              <label>Name</label>
              <Input
                type="text"
                size="medium"
                value={variant.name}
                disabled={rowLocked}
                placeholder="e.g. Small"
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </div>

            <div className={dashboardStyles.field}>
              <label>Paper</label>
              <SelectDropdown<string>
                options={PAPER_OPTIONS}
                value={variant.paperId}
                disabled={rowLocked}
                onChange={(v) => update(index, { paperId: v })}
              />
            </div>

            <div className={dashboardStyles.field}>
              <label>Print size &amp; border (cm)</label>
              <div className={styles.sizeRow}>
                <div className={styles.dimsCol}>
                  <CustomSizeInputs
                    custom={SIZE_CUSTOM}
                    aspectRatio={aspectRatio}
                    longEdgeBounds={longEdgeBounds}
                    customSize={{ widthCm: variant.widthCm, heightCm: variant.heightCm }}
                    disabled={rowLocked}
                    showSlider={false}
                    onChange={(size) =>
                      update(index, { widthCm: size.widthCm, heightCm: size.heightCm })
                    }
                  />
                  {duplicateSize && (
                    <p className={styles.error}>
                      Each variant must have a distinct print size — this one clashes with another.
                    </p>
                  )}
                </div>
                <label className={styles.borderField}>
                  <span>Border (cm)</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    size="medium"
                    value={variant.borderCm ? String(variant.borderCm) : ''}
                    disabled={rowLocked}
                    placeholder={String(LIMITED_BORDER_MIN_CM)}
                    onChange={(e) =>
                      update(index, { borderCm: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })
                    }
                  />
                  <span className={styles.hint}>min {LIMITED_BORDER_MIN_CM} cm, whole cm</span>
                </label>
              </div>
            </div>

            <div className={dashboardStyles.field} style={{ maxWidth: 200 }}>
              <label>Edition size</label>
              <Input
                type="text"
                inputMode="numeric"
                size="medium"
                value={variant.editionSize ? String(variant.editionSize) : ''}
                disabled={rowLocked}
                placeholder="50"
                onChange={(e) =>
                  update(index, { editionSize: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })
                }
              />
              {rowLocked && <p className={styles.hint}>Edition size is locked once published.</p>}
            </div>
          </div>
        )
      })}

      {!locked && variants.length < MAX_LIMITED_VARIANTS && (
        <Button type="button" variant="secondary" onClick={add}>
          + Add variant
        </Button>
      )}
    </div>
  )
}
