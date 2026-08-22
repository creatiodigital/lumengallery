'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal/ConfirmModal'
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
   *  CLOSE behavior) after a successful add. */
  onContinueShopping: () => void
  /** Limited editions only: "1/50" rendered on the preview. */
  editionLabel?: string
  /** Limited editions only: a friendly message when the reservation failed
   *  (sold out / only N left). Rendered above the CTA; not an error throw. */
  addError?: string | null
  /** True when the buyer arrived via the cart's "Edit item" link — the line
   *  is already in the cart, so the CTA reads "Update cart" not "Add to cart". */
  isEditing?: boolean
  /** True when the current configuration exactly matches a line already in the
   *  cart — adding would merge into a quantity bump, so we confirm first. */
  isDuplicate?: boolean
  /** True when the caller navigates away on a successful add (the limited path
   *  goes straight to the cart). Suppresses the "Continue shopping / Go to
   *  cart" pair, which would otherwise flash for a frame on the way out — and
   *  which a limited buyer should never be offered: walking away from a live
   *  hold is not an ordinary next step. */
  navigatesAfterAdd?: boolean
  /** True when a cart line already matches the CURRENT selection. Nothing is
   *  reserved by that — it just means the buyer has this exact print in their
   *  cart, so the action is to go and finish rather than add it twice. */
  alreadyInCart?: boolean
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
  isEditing = false,
  isDuplicate = false,
  navigatesAfterAdd = false,
  alreadyInCart = false,
}: SummaryPanelProps) => {
  const ctaLabel = isEditing ? 'Update cart' : 'Add to cart'
  const ctaBusyLabel = isEditing ? 'Updating…' : 'Adding…'
  // Local add-to-cart state. Once an item has been added we swap the
  // single CTA for the "Continue shopping / Go to cart" pair.
  const [added, setAdded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmDupOpen, setConfirmDupOpen] = useState(false)

  // Arrive from "Edit item" and change nothing and the line still matches, so
  // the button is "Go to cart" — there is no update to make. Pick a different
  // variant and it stops matching, and "Update cart" returns.
  const alreadyHeld = alreadyInCart

  // Reset add-to-cart state when the buyer changes their configuration
  // or switches variant — the previously added item no longer reflects
  // the current selection, so the CTA must return to "Add to cart".
  useEffect(() => {
    setAdded(false)
    setAdding(false)
  }, [config, editionLabel])

  const performAdd = async () => {
    if (adding) return
    setAdding(true)
    try {
      await onAddToCart()
      if (!navigatesAfterAdd) setAdded(true)
    } catch {
      // The reservation failed (sold out / insufficient stock). The parent
      // surfaces the message via `addError`; keep the CTA on "Add to cart"
      // and don't flip to the added state.
    } finally {
      setAdding(false)
    }
  }

  const handleAddToCart = () => {
    // The exact same print is already in the cart → confirm before merging
    // into a quantity bump, so a buyer reaching for "another size" isn't
    // surprised when an identical config silently increments instead.
    if (isDuplicate) {
      setConfirmDupOpen(true)
      return
    }
    void performAdd()
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
  // Vertical (top/bottom) paper border — only diverges from the
  // horizontal value for fixed-sheet limited editions (see
  // variantToWizardConfig.ts). Falls back to the horizontal value
  // everywhere else so nothing diverges.
  const borderYCm = config.borders?.['border']?.verticalCm ?? borderCm
  const matCm = getEffectiveMatCm(catalog, config)

  const showFrame = visuals.framed === true
  const moldingWidthCm = showFrame ? (visuals.mouldingWidthCm ?? 2.0) : 0
  const mattingBorderCm = showFrame ? matCm : 0
  const moldingColorHex = visuals.frameColorHex ?? '#f2f2f2'
  const mattingColorHex = visuals.matColorHex ?? '#f6f3ec'

  // Floating frame uses a colored backboard instead of a passepartout —
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
        {/* Artist and title only — the year belongs to the artwork's own page,
            where the buyer is deciding whether they want the work. Here they
            have already decided and are choosing paper and size. */}
        <div className={styles.summaryHeader}>
          <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
          <h2 className={styles.summaryTitle}>{artwork.title}</h2>
        </div>
        <Button
          variant="primary"
          size="bigSquared"
          fullWidth
          onClick={handleAddToCart}
          disabled
          label={ctaLabel}
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
            paperBorderYCm={borderYCm}
            backboardBorderCm={backboardBorderCm}
            backboardColorHex={backboardColorHex}
            editionLabel={editionLabel}
          />
        </div>
      )}

      <SpecList specs={summarizeConfig(catalog, config)} />

      {(() => {
        // Base price — the per-configuration figure (artwork + production, no
        // shipping, no VAT) so buyers can compare options. Shipping and tax are
        // folded in later at the cart/checkout. "Base" is the honest word for
        // it: "Item price" read like the amount that would be charged.
        const artworkLine = quote?.lines.find((l) => l.id === 'artwork')
        const placeholder = quoteLoading ? '…' : '—'
        return (
          <dl className={styles.priceList}>
            <div className={styles.priceRow}>
              <dt>Base price</dt>
              <dd>{artworkLine ? formatEuro(artworkLine.amountCents) : placeholder}</dd>
            </div>
            {/* Says out loud what "base" leaves out, at the point of decision
                rather than a page later. Same sentence the cart uses. */}
            <p className={styles.priceNote}>Shipping and taxes calculated at checkout.</p>
          </dl>
        )
      })()}

      {/* Already holding this exact print: the action is to go and finish, not
          to reserve a second numbered copy. "Add to cart" here both misread the
          state and pointed at the one thing the Terms forbid — one edition per
          household. Not while EDITING, where the buyer came from the cart to
          change this very line and still needs "Update cart". */}
      {alreadyHeld ? (
        <Button
          variant="primary"
          size="bigSquared"
          fullWidth
          href="/cart"
          label="Go to cart"
          className={styles.ctaButton}
        />
      ) : added ? (
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
            label={adding ? ctaBusyLabel : ctaLabel}
            className={styles.ctaButton}
          />
        </>
      )}

      {confirmDupOpen && (
        <ConfirmModal
          title="Already in your cart"
          message="You already have this exact print in your cart. Add it again and we’ll just increase that item’s quantity."
          confirmLabel="Add anyway"
          onConfirm={() => {
            setConfirmDupOpen(false)
            void performAdd()
          }}
          onCancel={() => setConfirmDupOpen(false)}
        />
      )}
    </aside>
  )
}
