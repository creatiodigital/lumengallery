'use client'

import { useMemo } from 'react'

import {
  type Catalog,
  type WizardConfig,
  collectVisualHints,
  getEffectiveBorderCm,
  getEffectiveMatCm,
  getEffectiveSizeCm,
} from '@/lib/print-providers'

import { SizeSchema } from './SizeSchema'

import styles from './PrintWizard.module.scss'

interface SchemaStageProps {
  catalog: Catalog
  config: WizardConfig
  /** Artwork preview URL — fills the print rect inside the diagram. */
  imageUrl: string
  /** Limited editions only: "1/50" drawn in the paper margin. */
  editionLabel?: string
}

/**
 * The wizard's center column: one large, dead-centered measurement diagram.
 *
 * This replaced a 3D room preview. The diagram answers the question the room
 * never did — how big is each part of this print — so it earns the center of
 * the screen and is drawn at a size the buyer can actually read off.
 *
 * The diagram's FOOTPRINT is fixed: `SizeSchema` fits the longest side to its
 * viewBox, so choosing a bigger edition redraws the same-sized picture with
 * different numbers on it. What changes with the size is the proportion
 * between layers — a 3 cm border rings a 20 cm print far more thickly than a
 * 60 cm one, and the diagram shows that.
 */
export const SchemaStage = ({ catalog, config, imageUrl, editionLabel }: SchemaStageProps) => {
  // Effective print size — preset OR custom. Sizes are stored in the
  // artwork's natural orientation; the schema renders them as-is, with no
  // portrait/landscape toggle anywhere.
  const effectiveSize = useMemo(() => getEffectiveSizeCm(catalog, config), [catalog, config])

  // Merged visual hints from every selected enum option. The TPS `color` and
  // `moulding` dimensions both write into `frameColorHex` — the merge picks
  // whichever is set.
  const visuals = useMemo(() => collectVisualHints(catalog, config), [catalog, config])

  if (!effectiveSize) return null

  const borderCm = getEffectiveBorderCm(config, 'border')
  // Vertical (top/bottom) paper border — only diverges from the horizontal
  // value for fixed-sheet limited editions (see variantToWizardConfig.ts).
  // Falls back to the horizontal value everywhere else.
  const borderYCm = config.borders?.['border']?.verticalCm ?? borderCm
  const matCm = getEffectiveMatCm(catalog, config)

  const showFrame = visuals.framed === true
  const moldingWidthCm = showFrame ? (visuals.mouldingWidthCm ?? 2.0) : 0
  const mattingBorderCm = showFrame ? matCm : 0
  const moldingColorHex = visuals.frameColorHex ?? '#f2f2f2'
  const mattingColorHex = visuals.matColorHex ?? '#f6f3ec'

  // A floating frame uses a colored backboard instead of a passepartout, so
  // the schema draws one (2 cm on every side) to keep it from reading
  // identically to Standard.
  const isFloatingFrame = showFrame && config.values.frameType === 'floating'
  const backboardBorderCm = isFloatingFrame ? 2 : 0

  return (
    <div className={styles.schemaStage}>
      <SizeSchema
        printWidthCm={effectiveSize.widthCm}
        printHeightCm={effectiveSize.heightCm}
        moldingWidthCm={moldingWidthCm}
        moldingColorHex={moldingColorHex}
        mattingBorderCm={mattingBorderCm}
        mattingColorHex={mattingColorHex}
        showFrame={showFrame}
        imageUrl={imageUrl}
        paperBorderCm={borderCm}
        paperBorderYCm={borderYCm}
        backboardBorderCm={backboardBorderCm}
        backboardColorHex="#f6f3ec"
        editionLabel={editionLabel}
      />
    </div>
  )
}
