'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { CartIcon } from '@/components/cart/CartIcon'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { clearPrintSession } from '@/components/checkout/clearPrintSession'
import { consumePrintReturnUrl } from '@/components/checkout/printReturnUrl'
import Logo from '@/icons/logo.svg'
import Monogram from '@/icons/monogram.svg'

import { buildCartItem } from '@/lib/cart/buildCartItem'
import { hasMatchingCartLine } from '@/lib/cart/cartMath'
import { useCart } from '@/lib/cart/useCart'
import {
  type Catalog,
  type PrintRecommendations,
  type PrintRestrictions,
  type Quote,
  type WizardConfig,
  buildAvailability,
  buildInitialConfig,
  isOptionVisible,
  summarizeConfig,
} from '@/lib/print-providers'
import { getPrintLongEdgeBounds } from '@/lib/print-providers/printspace'
import { getProviderQuote } from '@/lib/print-providers/quote'
import { TABLET_BREAKPOINT_PX, useIsMobile } from '@/hooks/useIsMobile'

import type { LimitedVariantView } from '@/lib/editions/types'

import { LimitedWizard } from './LimitedWizard'
import { CartAddedModal } from './CartAddedModal'
import { EditionBadge } from './EditionBadge'
import { Scene } from './Scene'
import { StepsPanel } from './StepsPanel'
import { SummaryPanel } from './SummaryPanel'

import styles from './PrintWizard.module.scss'

export type WizardArtwork = {
  id: string
  slug: string
  title: string
  artistName: string
  year?: string
  imageUrl: string
  originalWidthPx: number
  originalHeightPx: number
  printPriceCents: number
  /** 'open' (configurable) or 'limited' (pre-defined variants). Drives
   *  which wizard the dispatcher renders. Defaults to open. */
  editionType?: 'open' | 'limited'
  /** Published limited-edition variants with live stock. Only used when
   *  `editionType === 'limited'`. */
  variants?: LimitedVariantView[]
  /** Legacy limited-edition flag (superseded by editionType). */
  editionLimited?: boolean
  /** Legacy series size (superseded by per-variant editionSize). */
  editionTotal?: number | null
}

interface PrintWizardProps {
  artwork: WizardArtwork
  catalog: Catalog
  /** Provider-agnostic, dimension-keyed restriction map (already converted by the page route). */
  restrictions: PrintRestrictions | null
  /** Soft recommendations — surfaces a check-circle on the matching
   *  paper option in the picker. Paper-only for now. */
  recommendations: PrintRecommendations | null
}

/**
 * Dispatcher: limited-edition artworks get the constrained variant-picker
 * wizard; everything else gets the full configurable open-edition wizard.
 * The buyer never chooses — the artwork's `editionType` decides.
 */
export const PrintWizard = (props: PrintWizardProps) => {
  if (props.artwork.editionType === 'limited') {
    return <LimitedWizard artwork={props.artwork} catalog={props.catalog} />
  }
  return <OpenWizard {...props} />
}

const OpenWizard = ({ artwork, catalog, restrictions, recommendations }: PrintWizardProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  // The 3D room preview is desktop-only: on phones it eats most of the
  // viewport without aiding the size decision, and the WebGL canvas is
  // heavy on mobile GPUs/battery — so we skip mounting it entirely
  // rather than hiding it with CSS.
  const isMobile = useIsMobile(TABLET_BREAKPOINT_PX + 1)
  // The Scene renders only after mount: SSR and the first client render must
  // agree (hydration), and the server can't know the viewport — so neither
  // renders it, and the WebGL canvas never mounts at all on phones. Desktop
  // gets it one tick later, which is invisible (the canvas paints async).
  const [sceneReady, setSceneReady] = useState(false)
  useEffect(() => {
    setSceneReady(true)
  }, [])

  // Synchronous availability check, rebuilt only when the catalog
  // identity changes (i.e. essentially never within one wizard session).
  const availability = useMemo(() => buildAvailability(catalog), [catalog])

  // Measure the actual image client-side as a fallback when DB-reported
  // dimensions are absent or wrong.
  const [measuredAspect, setMeasuredAspect] = useState<number | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setMeasuredAspect(img.naturalWidth / img.naturalHeight)
      }
    }
    img.src = artwork.imageUrl
  }, [artwork.imageUrl])

  const aspectRatio =
    measuredAspect ??
    (artwork.originalWidthPx > 0 && artwork.originalHeightPx > 0
      ? artwork.originalWidthPx / artwork.originalHeightPx
      : 1)

  // Per-artwork size bounds — drives the size slider's range and the
  // input clamps. Computed from the artwork's pixel resolution and
  // the lab's hardware paper width. Null when the file is too small
  // to produce any sharp print (defensive — print-enabled artworks
  // should always pass eligibility).
  const longEdgeBounds = useMemo(
    () =>
      getPrintLongEdgeBounds(
        artwork.originalWidthPx > 0 && artwork.originalHeightPx > 0
          ? { width: artwork.originalWidthPx, height: artwork.originalHeightPx }
          : null,
      ),
    [artwork.originalWidthPx, artwork.originalHeightPx],
  )

  // Restore from URL params on mount (e.g. user came back from checkout
  // via backToWizard, which always forwards the in-flight selection in
  // the URL). A bare /print URL = fresh entry; we ignore + later wipe
  // any stale sessionStorage stash from a previous abandoned attempt.
  const urlSeed = useMemo(
    () => readConfigFromParams(catalog, searchParams),
    [catalog, searchParams],
  )
  const hasSeed =
    Object.keys(urlSeed.values).length > 0 ||
    urlSeed.customSize !== undefined ||
    urlSeed.borders !== undefined

  const [config, setConfig] = useState<WizardConfig>(() => {
    const fresh = buildInitialConfig(catalog, aspectRatio, restrictions)
    if (!hasSeed) return fresh
    return {
      ...fresh,
      values: { ...fresh.values, ...urlSeed.values },
      customSize: urlSeed.customSize ?? fresh.customSize,
      borders: urlSeed.borders ?? fresh.borders,
    }
  })

  // Fresh entry → wipe leftovers from a prior abandoned flow so the
  // wizard / checkout / payment surfaces don't surface stale country,
  // address, or payment-intent ids.
  useEffect(() => {
    if (hasSeed) return
    try {
      sessionStorage.removeItem(`print-quote:${artwork.slug}`)
      sessionStorage.removeItem(`print-address:${artwork.slug}`)
      sessionStorage.removeItem(`print-payment:${artwork.slug}`)
    } catch {
      // sessionStorage may be unavailable — non-fatal.
    }
  }, [hasSeed, artwork.slug])

  // Edition-details modal — opened ONLY when the buyer clicks "See Details" on
  // the persistent edition badge. No auto-show: the badge keeps the edition
  // type visible at all times, without interrupting the buyer.
  const [introOpen, setIntroOpen] = useState(false)
  const dismissIntro = () => setIntroOpen(false)

  const updateConfig = (patch: Record<string, string>) => {
    setConfig((prev) => {
      const nextValues = { ...prev.values, ...patch }
      // Picking 'None' for the passepartout color hides the mount-size
      // input via cascade; reset the stored size so it doesn't re-appear
      // (e.g. 4.5 cm sticking around) when the buyer later switches back
      // to a colored mount.
      let nextBorders = prev.borders
      if (patch.windowMount === 'none' && prev.borders?.windowMountSize) {
        nextBorders = { ...prev.borders, windowMountSize: { allCm: 0 } }
      }
      // Re-validate enum selections whose option-level visibleWhen
      // depends on a value that just changed (e.g. moulding options
      // cascade on frameType). Without this, switching the parent
      // leaves a stale child id whose option is filtered out of the
      // dropdown but still rendered in the summary panel.
      const probe: WizardConfig = { ...prev, values: nextValues, borders: nextBorders }
      for (const dim of catalog.dimensions) {
        if (dim.kind !== 'enum') continue
        const current = nextValues[dim.id]
        if (!current) continue
        const opt = dim.options.find((o) => o.id === current)
        if (opt && isOptionVisible(opt, probe)) continue
        const replacement =
          dim.options.find((o) => o.isDefault && isOptionVisible(o, probe)) ??
          dim.options.find((o) => isOptionVisible(o, probe))
        if (replacement) nextValues[dim.id] = replacement.id
        else delete nextValues[dim.id]
      }
      return { ...prev, values: nextValues, borders: nextBorders }
    })
  }

  const updateCustomSize = (size: { widthCm: number; heightCm: number }) => {
    setConfig((prev) => ({ ...prev, customSize: size }))
  }

  const updateBorder = (dimensionId: string, allCm: number) => {
    setConfig((prev) => ({
      ...prev,
      borders: { ...(prev.borders ?? {}), [dimensionId]: { allCm } },
    }))
  }

  // Country lives on the checkout step. If the buyer already picked one
  // there and bounced back to the wizard via the URL-seeded path, it
  // persists via the wizard handoff stash so it feeds getProviderQuote.
  // On fresh entry (no URL seed) we ignore the stash — that's an
  // abandon-restart.
  const [country] = useState<string>(() => {
    if (!hasSeed) return ''
    if (typeof window === 'undefined') return ''
    try {
      const raw = sessionStorage.getItem(`print-quote:${artwork.slug}`)
      if (!raw) return ''
      const parsed = JSON.parse(raw) as { country?: unknown }
      return typeof parsed.country === 'string' ? parsed.country : ''
    } catch {
      return ''
    }
  })

  const canContinue = true

  // Synchronous price compute. The quote function is pure math (no DB,
  // no fetch, no secrets) — running it client-side gives the buyer an
  // instant price update on every config change, no round-trip, no
  // debounce, no cancellation chain. The server re-runs this exact
  // function at payment-intent creation so a tampered client price
  // never reaches Stripe.
  const quote: Quote = useMemo(
    () =>
      getProviderQuote(catalog.providerId, {
        config,
        country,
        artistPriceCents: artwork.printPriceCents,
      }),
    [catalog.providerId, config, country, artwork.printPriceCents],
  )
  const quoteLoading = false

  const { addItem, removeItem, items } = useCart()
  const [cartAddedOpen, setCartAddedOpen] = useState(false)

  // When the buyer arrived via the cart's "Edit item" link, the line's id rides
  // in the URL. Re-adding replaces that line (removed just before the add) so
  // editing reconfigures in place instead of leaving a duplicate behind.
  const editLineId = searchParams.get('editLineId')

  const close = () => {
    clearPrintSession(artwork.slug)
    router.push(consumePrintReturnUrl(artwork.slug) ?? '/prints')
  }

  // The current config already sits in the cart as its own line (ignoring the
  // line being edited) → adding merges into a quantity bump, so we confirm.
  const isDuplicate = useMemo(
    () => hasMatchingCartLine(items, { artworkId: artwork.id, config }, editLineId ?? undefined),
    [items, artwork.id, config, editLineId],
  )

  const handleAddToCart = async () => {
    // Editing: carry the original line's quantity so the edit applies to the
    // whole line (a qty-2 line stays qty 2), then drop that line so the re-add
    // replaces it — merging into an identical line if one now matches.
    const quantity = editLineId ? (items.find((i) => i.lineId === editLineId)?.quantity ?? 1) : 1
    if (editLineId) await removeItem(editLineId)
    await addItem({
      ...buildCartItem({
        artwork: {
          id: artwork.id,
          slug: artwork.slug,
          title: artwork.title,
          artistName: artwork.artistName,
          thumbnailUrl: artwork.imageUrl,
        },
        providerId: catalog.providerId,
        editionType: 'open',
        config,
        quote,
        artistCents: artwork.printPriceCents,
        specsSummary: summarizeConfig(catalog, config),
      }),
      quantity,
    })
    setCartAddedOpen(true)
  }

  return (
    <div className={styles.wizard}>
      <header className={styles.header}>
        <Link href="/" aria-label="Go to home" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
        <span />
        <div className={styles.headerActions}>
          <CartIcon />
          <Button
            variant="ghost"
            onClick={close}
            label="CLOSE"
            iconRight={<Icon name="close" size={16} />}
            className={styles.closeButton}
            aria-label="Close wizard"
          />
        </div>
      </header>

      <main className={styles.body}>
        <EditionBadge editionType="open" onDetails={() => setIntroOpen(true)} />
        <StepsPanel
          catalog={catalog}
          config={config}
          aspectRatio={aspectRatio}
          longEdgeBounds={longEdgeBounds}
          onChange={updateConfig}
          onCustomSizeChange={updateCustomSize}
          onBorderChange={updateBorder}
          availability={availability}
          restrictions={restrictions}
          recommendations={recommendations}
        />
        {sceneReady && !isMobile && (
          <Scene imageUrl={artwork.imageUrl} catalog={catalog} config={config} configReady />
        )}
        <SummaryPanel
          artwork={artwork}
          catalog={catalog}
          config={config}
          quote={quote}
          quoteLoading={quoteLoading}
          canContinue={canContinue}
          configReady
          onAddToCart={handleAddToCart}
          onContinueShopping={close}
          isEditing={editLineId !== null}
          isDuplicate={isDuplicate}
        />
      </main>

      {cartAddedOpen && (
        <CartAddedModal onClose={() => setCartAddedOpen(false)} edited={editLineId !== null} />
      )}

      {introOpen && (
        <Modal onClose={dismissIntro} titleId="print-intro-title" maxWidth="640px">
          <div className={styles.introModal}>
            <Monogram className={styles.introMonogram} aria-hidden="true" />
            <p id="print-intro-title" className={styles.detailLead}>
              Your print of <strong>{artwork.title}</strong> by{' '}
              <strong>{artwork.artistName}</strong> is an <strong>open edition</strong>.
            </p>
            <div className={styles.detailSections}>
              <p className={styles.detailSubhead}>Terms of sale</p>
              <ul className={styles.detailList}>
                <li>
                  Made to order on premium archival paper (giclée or C-Type), hand-inspected and
                  finished by a specialist fine-art print lab.
                </li>
                <li>
                  Fully configurable — choose your size, paper and framing (framed or print-only).
                </li>
                <li>Not numbered and not a limited run — available on an ongoing basis.</li>
                <li>No purchase limits — order as many as you like.</li>
                <li>Final VAT is calculated when you confirm your delivery address at checkout.</li>
                <li>We reserve the right to cancel or refund an order if needed.</li>
              </ul>
              <p className={styles.detailSubhead}>Shipping</p>
              <ul className={styles.detailList}>
                <li>
                  All prints are packaged to the highest standards, managed at our warehouse using
                  archival materials.
                </li>
                <li>Shipping is calculated at checkout, based on your delivery address.</li>
                <li>
                  Most orders are dispatched within about two weeks; framed pieces can take a little
                  longer.
                </li>
                <li>
                  Sent with tracked delivery &mdash; we&rsquo;ll email you the tracking when
                  it&rsquo;s on its way.
                </li>
                <li>Delivery is typically 1&ndash;2 weeks.</li>
                <li>Orders may be subject to customs and local import duties.</li>
              </ul>
            </div>
            <p className={styles.detailTerms}>
              Please read our{' '}
              <Link href="/terms-of-sale" target="_blank" rel="noopener noreferrer">
                full terms of sale
              </Link>
              .
            </p>
            <div className={styles.introActions}>
              <Button variant="primary" label="Close" onClick={dismissIntro} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/**
 * Reconstruct a partial config from URL params. Accept a param only
 * when its key matches a catalog dimension id AND its value is a
 * valid option for that dimension. This protects against stale URLs
 * from a different config that doesn't fit the current catalog — e.g.
 * a stale URL `size=60x80` getting merged into a new catalog where
 * size is custom-only and `60x80` resolves to nothing.
 *
 * Also parses `customSize=WxH` (custom W×H in cm) and any border-
 * kind dimension's numeric value, so the buyer's full configuration
 * survives a back-and-forth through the URL — not just enum picks.
 */
function readConfigFromParams(
  catalog: Catalog,
  params: URLSearchParams,
): {
  values: Record<string, string>
  customSize?: { widthCm: number; heightCm: number }
  borders?: Record<string, { allCm: number }>
} {
  const values: Record<string, string> = {}
  const borders: Record<string, { allCm: number }> = {}
  let customSize: { widthCm: number; heightCm: number } | undefined
  const dimsById = new Map(catalog.dimensions.map((d) => [d.id, d]))
  params.forEach((value, key) => {
    if (key === 'country' || key === 'provider') return
    if (key === 'customSize') {
      const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(value)
      if (m) {
        const w = Number(m[1])
        const h = Number(m[2])
        if (w > 0 && h > 0) customSize = { widthCm: w, heightCm: h }
      }
      return
    }
    const dim = dimsById.get(key)
    if (!dim) return
    if (dim.kind === 'enum') {
      if (dim.options.some((o) => o.id === value)) values[key] = value
    } else if (dim.kind === 'size') {
      if (dim.options.some((o) => o.id === value)) values[key] = value
    } else if (dim.kind === 'border') {
      const cm = Number(value)
      if (Number.isFinite(cm) && cm >= dim.minCm && cm <= dim.maxCm) {
        borders[key] = { allCm: cm }
      }
    }
  })
  return {
    values,
    customSize,
    borders: Object.keys(borders).length > 0 ? borders : undefined,
  }
}
