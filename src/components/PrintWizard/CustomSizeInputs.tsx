'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/Input'
import { Slider } from '@/components/ui/Slider'

import { type SizeDimension, type WizardConfig, clampCm } from '@/lib/print-providers'
import { type PrintLongEdgeBounds, formatPrintSize } from '@/lib/print-providers/printspace'

import styles from './PrintWizard.module.scss'

// Aspect-locked height × width inputs + a long-edge slider. Extracted
// from StepsPanel so the buyer wizard and the dashboard's limited-variant
// editor share ONE implementation (identical clamps, aspect lock and
// range labels). Catalog-agnostic: it takes the `custom` bounds directly
// rather than a full SizeDimension.
interface CustomSizeInputsProps {
  custom: SizeDimension['custom']
  aspectRatio: number
  longEdgeBounds: PrintLongEdgeBounds | null
  customSize: WizardConfig['customSize']
  disabled: boolean
  onChange: (size: { widthCm: number; heightCm: number }) => void
  /** Show the long-edge slider. Default true (buyer wizard / interactive
   *  diagram). The dashboard variant editor passes false — inputs only. */
  showSlider?: boolean
}

export const CustomSizeInputs = ({
  custom,
  aspectRatio,
  longEdgeBounds,
  customSize,
  disabled,
  onChange,
  showSlider = true,
}: CustomSizeInputsProps) => {
  // Hooks must be called unconditionally on every render. We don't
  // bail out on `!custom` until after they've been declared, so the
  // hook order stays stable when the dimension switches between
  // custom-size and preset-size variants.
  const widthCm = customSize?.widthCm ?? 0
  const heightCm = customSize?.heightCm ?? 0
  const stepCmForInit = custom?.stepCm ?? 1
  const [widthInput, setWidthInput] = useState<string>(formatCm(widthCm, stepCmForInit))
  const [heightInput, setHeightInput] = useState<string>(formatCm(heightCm, stepCmForInit))
  const [editing, setEditing] = useState<'width' | 'height' | null>(null)

  if (!custom) return null

  // Sync local input with external customSize updates when the user
  // isn't actively typing in either field.
  if (editing === null) {
    const wStr = formatCm(widthCm, custom.stepCm)
    const hStr = formatCm(heightCm, custom.stepCm)
    if (wStr !== widthInput) setWidthInput(wStr)
    if (hStr !== heightInput) setHeightInput(hStr)
  }

  const aspectLocked = custom.aspectLocked === true
  const ratioWH = aspectLocked && aspectRatio > 0 ? aspectRatio : null

  const effectiveMinLongCm = longEdgeBounds?.minLongCm ?? custom.minCm
  const effectiveMaxLongCm = longEdgeBounds?.maxLongCm ?? custom.maxCm
  const aspectShortOverLong =
    longEdgeBounds?.aspect ?? (ratioWH !== null ? Math.min(ratioWH, 1 / ratioWH) : 1)
  const isPortrait = longEdgeBounds?.isPortrait ?? (ratioWH !== null && ratioWH < 1)
  const minShortCm = effectiveMinLongCm * aspectShortOverLong
  const maxShortCm = effectiveMaxLongCm * aspectShortOverLong
  const minWidthCm = isPortrait ? minShortCm : effectiveMinLongCm
  const maxWidthCm = isPortrait ? maxShortCm : effectiveMaxLongCm
  const minHeightCm = isPortrait ? effectiveMinLongCm : minShortCm
  const maxHeightCm = isPortrait ? effectiveMaxLongCm : maxShortCm

  const currentLongCm = Math.max(widthCm, heightCm)

  const commitLongEdge = (longCm: number) => {
    const clampedLong = clampCm(longCm, effectiveMinLongCm, effectiveMaxLongCm, custom.stepCm)
    const shortCm = clampedLong * aspectShortOverLong
    const newWidth = isPortrait ? shortCm : clampedLong
    const newHeight = isPortrait ? clampedLong : shortCm
    setWidthInput(formatCm(newWidth, custom.stepCm))
    setHeightInput(formatCm(newHeight, custom.stepCm))
    onChange({ widthCm: newWidth, heightCm: newHeight })
  }

  const handleChange = (which: 'width' | 'height', raw: string) => {
    if (which === 'width') setWidthInput(raw)
    else setHeightInput(raw)
    const parsed = Number(raw.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) return

    if (ratioWH === null) {
      const w = which === 'width' ? clampCm(parsed, minWidthCm, maxWidthCm, custom.stepCm) : widthCm
      const h =
        which === 'height' ? clampCm(parsed, minHeightCm, maxHeightCm, custom.stepCm) : heightCm
      onChange({ widthCm: w, heightCm: h })
      return
    }

    let w: number
    let h: number
    if (which === 'width') {
      w = clampCm(parsed, minWidthCm, maxWidthCm, custom.stepCm)
      h = clampCm(w / ratioWH, minHeightCm, maxHeightCm, custom.stepCm)
      setHeightInput(formatCm(h, custom.stepCm))
    } else {
      h = clampCm(parsed, minHeightCm, maxHeightCm, custom.stepCm)
      w = clampCm(h * ratioWH, minWidthCm, maxWidthCm, custom.stepCm)
      setWidthInput(formatCm(w, custom.stepCm))
    }
    onChange({ widthCm: w, heightCm: h })
  }

  return (
    <div className={styles.customSizeRow}>
      <label className={styles.customSizeField}>
        <span>Height (cm)</span>
        <Input
          type="text"
          inputMode="decimal"
          value={heightInput}
          disabled={disabled}
          onFocus={() => setEditing('height')}
          onBlur={() => setEditing(null)}
          onChange={(e) => handleChange('height', e.target.value)}
          aria-label="Custom print height in centimeters"
        />
      </label>
      <span className={styles.customSizeSeparator} aria-hidden="true">
        ×
      </span>
      <label className={styles.customSizeField}>
        <span>Width (cm)</span>
        <Input
          type="text"
          inputMode="decimal"
          value={widthInput}
          disabled={disabled}
          onFocus={() => setEditing('width')}
          onBlur={() => setEditing(null)}
          onChange={(e) => handleChange('width', e.target.value)}
          aria-label="Custom print width in centimeters"
        />
      </label>
      {showSlider && (
        <div className={styles.customSizeSlider}>
          <Slider
            min={effectiveMinLongCm}
            max={effectiveMaxLongCm}
            step={custom.stepCm}
            value={Math.min(effectiveMaxLongCm, Math.max(effectiveMinLongCm, currentLongCm))}
            disabled={disabled}
            onChange={(v) => commitLongEdge(v)}
            aria-label="Print size"
          />
          <div className={styles.customSizeRangeLabels}>
            <span>
              {formatPrintSize(
                isPortrait ? effectiveMinLongCm : minShortCm,
                isPortrait ? minShortCm : effectiveMinLongCm,
              )}
            </span>
            <span>
              {formatPrintSize(
                isPortrait ? effectiveMaxLongCm : maxShortCm,
                isPortrait ? maxShortCm : effectiveMaxLongCm,
              )}
            </span>
          </div>
        </div>
      )}
      {aspectLocked && (
        <p className={styles.customSizeHint}>
          {showSlider
            ? "Height and width are locked to this artwork's aspect ratio — change either, the other follows. This artwork can be printed at any size in the range above."
            : `Locked to the artwork's aspect ratio. Printable range for this file: ${formatPrintSize(
                isPortrait ? effectiveMinLongCm : minShortCm,
                isPortrait ? minShortCm : effectiveMinLongCm,
              )} – ${formatPrintSize(
                isPortrait ? effectiveMaxLongCm : maxShortCm,
                isPortrait ? maxShortCm : effectiveMaxLongCm,
              )}.`}
        </p>
      )}
    </div>
  )
}

export function formatCm(value: number, step: number): string {
  if (!Number.isFinite(value) || value === 0) return ''
  const decimals = step >= 1 ? 0 : Math.ceil(-Math.log10(step))
  return value.toFixed(decimals)
}
