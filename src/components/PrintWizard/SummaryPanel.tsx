'use client'

import { useMemo } from 'react'

import { Button } from '@/components/ui/Button'
import {
  type Catalog,
  type Quote,
  type WizardConfig,
  collectVisualHints,
  formatEuro,
  getEffectiveBorderCm,
  getEffectiveMatCm,
  getEffectiveSizeCm,
  summarizeConfig,
} from '@/lib/print-providers'

import { SpecList } from '../print/SpecList/SpecList'
import { SizeSchema } from './SizeSchema'
import type { WizardArtwork } from './index'

import styles from './PrintWizard.module.scss'

interface SummaryPanelProps {
  artwork: WizardArtwork
  catalog: Catalog
  config: WizardConfig
  /** ISO country code if the buyer already picked one on checkout (then
   *  navigated back). Empty string when the destination hasn't been
   *  chosen yet — the summary shows "—" for shipping in that case. */
  country: string
  quote: Quote | null
  quoteLoading: boolean
  canContinue: boolean
  configReady: boolean
  onAddToCart: () => void
}

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code

export const SummaryPanel = ({
  artwork,
  catalog,
  config,
  country,
  quote,
  quoteLoading,
  canContinue,
  configReady,
  onAddToCart,
}: SummaryPanelProps) => {
  // Effective print size — preset OR custom. Drives schema + label.
  // Sizes are stored in the artwork's natural orientation; the schema
  // renders them as-is, no portrait/landscape toggle anywhere.
  const effectiveSize = useMemo(() => getEffectiveSizeCm(catalog, config), [catalog, config])

  // Merged visual hints from every selected enum option. The TPS
  // (`color` dim) and TPS (`moulding` dim) write into `frameColorHex`
  // — the merge picks whichever is set.
  const visuals = useMemo(() => collectVisualHints(catalog, config), [catalog, config])

  const borderCm = getEffectiveBorderCm(config, 'border')
  const matCm = getEffectiveMatCm(catalog, config)

  const showFrame = visuals.framed === true
  const moldingWidthCm = showFrame ? (visuals.mouldingWidthCm ?? 2.0) : 0
  const mattingBorderCm = showFrame ? matCm : 0
  const moldingColorHex = visuals.frameColorHex ?? '#0b0b0b'
  const mattingColorHex = visuals.matColorHex ?? '#f6f3ec'

  // Floating frame uses a coloured backboard instead of a passepartout —
  // surface that visually in the 2D schema so it doesn't read identically
  // to Standard. Backboard border matches the FloatingPreview default
  // (2 cm on every side, see scene/preview/FloatingPreview.tsx).
  const isFloatingFrame = showFrame && config.values.frameType === 'floating'
  const backboardBorderCm = isFloatingFrame ? 2 : 0
  const backboardColorHex = '#f6f3ec'

  const printWidthCm = effectiveSize?.widthCm ?? 0
  const printHeightCm = effectiveSize?.heightCm ?? 0

  if (!configReady) {
    return (
      <aside className={styles.summaryPanel}>
        <div className={styles.summaryHeader}>
          <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
          <h2 className={styles.summaryTitle}>{artwork.title}</h2>
          {artwork.year && <span className={styles.summaryYear}>{artwork.year}</span>}
        </div>
        <Button
          variant="primary"
          size="bigSquared"
          fullWidth
          onClick={onAddToCart}
          disabled
          label="Add shipping address"
          className={styles.ctaButton}
        />
      </aside>
    )
  }

  return (
    <aside className={styles.summaryPanel}>
      <div className={styles.summaryHeader}>
        <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
        <h2 className={styles.summaryTitle}>{artwork.title}</h2>
        {artwork.year && <span className={styles.summaryYear}>{artwork.year}</span>}
      </div>

      {effectiveSize && (
        <div className={styles.schemaSection}>
          <SizeSchema
            printWidthCm={printWidthCm}
            printHeightCm={printHeightCm}
            moldingWidthCm={moldingWidthCm}
            moldingColorHex={moldingColorHex}
            mattingBorderCm={mattingBorderCm}
            mattingColorHex={mattingColorHex}
            showFrame={showFrame}
            imageUrl={artwork.imageUrl}
            paperBorderCm={borderCm}
            backboardBorderCm={backboardBorderCm}
            backboardColorHex={backboardColorHex}
          />
        </div>
      )}

      <SpecList specs={summarizeConfig(catalog, config)} />

      {(() => {
        const artworkLine = quote?.lines.find((l) => l.id === 'artwork')
        const shippingLine = quote?.lines.find((l) => l.id === 'shipping')
        const placeholder = quoteLoading ? '…' : '—'
        const vatLabel = quote?.taxLabel ?? 'VAT'
        return (
          <dl className={styles.priceList}>
            <div className={styles.priceRow}>
              <dt>Shipping to</dt>
              <dd>{country ? countryName(country) : '—'}</dd>
            </div>
            <div className={styles.priceRow}>
              <dt>Artwork</dt>
              <dd>{artworkLine ? formatEuro(artworkLine.amountCents) : placeholder}</dd>
            </div>
            <div className={`${styles.priceRow} ${styles.priceRowMuted}`}>
              <dt>Shipping</dt>
              <dd>{shippingLine ? formatEuro(shippingLine.amountCents) : '—'}</dd>
            </div>
            <div className={`${styles.priceRow} ${styles.priceRowMuted}`}>
              <dt>{vatLabel}</dt>
              <dd>{quote && quote.taxCents > 0 ? formatEuro(quote.taxCents) : '—'}</dd>
            </div>
          </dl>
        )
      })()}

      <Button
        variant="primary"
        size="bigSquared"
        fullWidth
        onClick={onAddToCart}
        disabled={!canContinue}
        label="Add shipping address"
        className={styles.ctaButton}
      />
    </aside>
  )
}
