'use client'

import { useEffect, useMemo, useState } from 'react'

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
  quote: Quote | null
  quoteLoading: boolean
  canContinue: boolean
  configReady: boolean
  /** Adds the configured item to the cart. Async to leave room for a
   *  server-side reservation step (limited editions) before the line
   *  is committed. Resolve only on a successful add. */
  onAddToCart: () => Promise<void>
  /** Returns the buyer to where they came from (reuses the wizard's
   *  CLOSE behaviour) after a successful add. */
  onContinueShopping: () => void
  /** Limited editions only: "1/50" rendered on the preview. */
  editionLabel?: string
  /** Limited editions only: a friendly message when the reservation failed
   *  (sold out / only N left). Rendered above the CTA; not an error throw. */
  addError?: string | null
}

export const SummaryPanel = ({
  artwork,
  catalog,
  config,
  quote,
  quoteLoading,
  canContinue,
  configReady,
  onAddToCart,
  onContinueShopping,
  editionLabel,
  addError,
}: SummaryPanelProps) => {
  // Local add-to-cart state. Once an item has been added we swap the
  // single CTA for the "Continue shopping / Go to cart" pair.
  const [added, setAdded] = useState(false)
  const [adding, setAdding] = useState(false)

  // Reset add-to-cart state when the buyer changes their configuration
  // or switches variant — the previously added item no longer reflects
  // the current selection, so the CTA must return to "Add to cart".
  useEffect(() => {
    setAdded(false)
    setAdding(false)
  }, [config, editionLabel])

  const handleAddToCart = async () => {
    if (adding) return
    setAdding(true)
    try {
      await onAddToCart()
      setAdded(true)
    } catch {
      // The reservation failed (sold out / insufficient stock). The parent
      // surfaces the message via `addError`; keep the CTA on "Add to cart"
      // and don't flip to the added state.
    } finally {
      setAdding(false)
    }
  }
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
  const moldingColorHex = visuals.frameColorHex ?? '#f2f2f2'
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
          onClick={handleAddToCart}
          disabled
          label="Add to cart"
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
            editionLabel={editionLabel}
          />
        </div>
      )}

      <SpecList specs={summarizeConfig(catalog, config)} />

      {(() => {
        // Item price only — the wizard shows the per-configuration price
        // (artwork + production, no shipping, no VAT) so buyers can compare
        // options. Shipping and tax are folded in later at the cart/checkout.
        const artworkLine = quote?.lines.find((l) => l.id === 'artwork')
        const placeholder = quoteLoading ? '…' : '—'
        return (
          <dl className={styles.priceList}>
            <div className={styles.priceRow}>
              <dt>Item price</dt>
              <dd>{artworkLine ? formatEuro(artworkLine.amountCents) : placeholder}</dd>
            </div>
          </dl>
        )
      })()}

      {added ? (
        <div className={styles.addedActions}>
          <Button
            variant="secondary"
            size="bigSquared"
            fullWidth
            onClick={onContinueShopping}
            label="Continue shopping"
          />
          <Button
            variant="primary"
            size="bigSquared"
            fullWidth
            href="/cart"
            label="Go to cart"
            className={styles.ctaButton}
          />
        </div>
      ) : (
        <>
          {addError && (
            <p className={styles.addError} role="alert">
              {addError}
            </p>
          )}
          <Button
            variant="primary"
            size="bigSquared"
            fullWidth
            onClick={handleAddToCart}
            disabled={!canContinue || adding}
            label={adding ? 'Adding…' : 'Add to cart'}
            className={styles.ctaButton}
          />
        </>
      )}
    </aside>
  )
}
