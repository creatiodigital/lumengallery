'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { CartIcon } from '@/components/cart/CartIcon'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { clearPrintSession } from '@/components/checkout/clearPrintSession'
import { consumePrintReturnUrl } from '@/components/checkout/printReturnUrl'
import Logo from '@/icons/logo.svg'
import Monogram from '@/icons/monogram.svg'

import { buildCartItem } from '@/lib/cart/buildCartItem'
import { hasMatchingCartLine } from '@/lib/cart/cartMath'
import { useCart } from '@/lib/cart/useCart'
import { type Catalog, type Quote, summarizeConfig } from '@/lib/print-providers'
import { getProviderQuote } from '@/lib/print-providers/quote'
import { variantToWizardConfig } from '@/lib/editions/variantToWizardConfig'
import { TABLET_BREAKPOINT_PX, useIsMobile } from '@/hooks/useIsMobile'

import { CartAddedModal } from './CartAddedModal'
import { EditionBadge } from './EditionBadge'
import { Scene } from './Scene'
import { SummaryPanel } from './SummaryPanel'
import { VariantPicker, type VariantPickerItem } from './VariantPicker'
import type { WizardArtwork } from './index'

import styles from './PrintWizard.module.scss'

type Props = {
  artwork: WizardArtwork
  catalog: Catalog
}

function readCountryFromStash(slug: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = sessionStorage.getItem(`print-quote:${slug}`)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { country?: unknown }
    return typeof parsed.country === 'string' ? parsed.country : ''
  } catch {
    return ''
  }
}

/**
 * The limited-edition wizard: the buyer simply picks one of the artwork's
 * pre-defined variants — no size/paper/framing config. A selected variant
 * is translated into a canonical `WizardConfig` (`variantToWizardConfig`)
 * so the preview, summary, pricing and checkout handoff all reuse the
 * existing machinery unchanged. The chosen `variantId` is forwarded to
 * checkout so the server can reserve an edition number.
 */
export const LimitedWizard = ({ artwork, catalog }: Props) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Desktop-only 3D preview — same rationale and breakpoint as the open
  // wizard: never mount the WebGL canvas on mobile, and only mount it after
  // hydration so SSR and the first client render agree.
  const isMobile = useIsMobile(TABLET_BREAKPOINT_PX + 1)
  const [sceneReady, setSceneReady] = useState(false)
  useEffect(() => {
    setSceneReady(true)
  }, [])
  // Set when the buyer came from the cart's "Edit item" link — re-adding
  // replaces this line (removed just before the add) instead of duplicating it.
  const editLineId = searchParams.get('editLineId')

  // Sold-out variants are hidden — only buyable ones are offered.
  const available = useMemo(
    () => (artwork.variants ?? []).filter((v) => v.remaining > 0),
    [artwork.variants],
  )
  // Restore the buyer's chosen variant when re-entering via the cart's "Edit
  // item" link (which passes `?variant=<id>`); otherwise default to the first
  // available edition. Without this, editing always reset to the first variant.
  const requestedVariantId = searchParams.get('variant')
  const [selectedVariantId, setSelectedVariantId] = useState(() =>
    requestedVariantId && available.some((v) => v.id === requestedVariantId)
      ? requestedVariantId
      : (available[0]?.id ?? ''),
  )
  const [country] = useState<string>(() => readCountryFromStash(artwork.slug))

  // Edition-details modal — opened ONLY when the buyer clicks "See Details" on
  // the persistent edition badge. No auto-show: the badge keeps the edition
  // type visible at all times, without interrupting the buyer.
  const [introOpen, setIntroOpen] = useState(false)
  const dismissIntro = () => setIntroOpen(false)

  const selected = available.find((v) => v.id === selectedVariantId) ?? available[0] ?? null
  // For the details modal: fall back to any variant (incl. sold-out) so the
  // edition-size text still renders when the whole edition is sold out.
  const detailVariant = selected ?? artwork.variants?.[0] ?? null

  const config = useMemo(() => (selected ? variantToWizardConfig(selected) : null), [selected])

  const quote: Quote | null = useMemo(
    () =>
      config
        ? getProviderQuote(catalog.providerId, {
            config,
            country,
            // Limited editions price per variant; fall back to the artwork
            // price only if a variant somehow lacks its own.
            artistPriceCents: selected?.priceCents ?? artwork.printPriceCents,
          })
        : null,
    [config, country, catalog.providerId, selected?.priceCents, artwork.printPriceCents],
  )

  // Per-variant price for the picker cards (same pre-country basis the
  // summary uses on fresh entry).
  const pickerItems: VariantPickerItem[] = useMemo(
    () =>
      available.map((v) => ({
        ...v,
        priceCents: getProviderQuote(catalog.providerId, {
          config: variantToWizardConfig(v),
          country,
          artistPriceCents: v.priceCents ?? artwork.printPriceCents,
        }).subtotalCents,
      })),
    [available, country, catalog.providerId, artwork.printPriceCents],
  )

  const { addItem, removeItem, items } = useCart()
  const [addError, setAddError] = useState<string | null>(null)
  const [cartAddedOpen, setCartAddedOpen] = useState(false)

  // Clear any stale add error when the buyer switches variant — the previous
  // sold-out message no longer applies to the new selection.
  useEffect(() => {
    setAddError(null)
  }, [selectedVariantId])

  const close = () => {
    clearPrintSession(artwork.slug)
    router.push(consumePrintReturnUrl(artwork.slug) ?? '/prints')
  }

  // Same variant + config already in the cart (ignoring any line being edited)
  // → adding merges into a quantity bump, so we confirm first.
  const isDuplicate = useMemo(
    () =>
      !!config &&
      hasMatchingCartLine(
        items,
        { artworkId: artwork.id, variantId: selected?.id, config },
        editLineId ?? undefined,
      ),
    [items, artwork.id, selected?.id, config, editLineId],
  )

  const handleAddToCart = async () => {
    if (!selected || !config || !quote) return

    setAddError(null)

    // Editing: carry the original line's quantity (the edit applies to the
    // whole line), then drop that line so the re-add replaces it.
    const quantity = editLineId ? (items.find((i) => i.lineId === editLineId)?.quantity ?? 1) : 1
    if (editLineId) await removeItem(editLineId)

    // `addItem` reserves the edition number server-side BEFORE committing the
    // line; on sold-out / insufficient stock it throws so we surface a
    // friendly message and leave the cart untouched. Re-throw so SummaryPanel
    // does not flip to its "added" state.
    try {
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
          editionType: 'limited',
          variantId: selected.id,
          editionName: selected.name,
          config,
          quote,
          artistCents: selected.priceCents ?? artwork.printPriceCents,
          specsSummary: summarizeConfig(catalog, config),
        }),
        quantity,
      })
      setCartAddedOpen(true)
    } catch (error) {
      const reason = error instanceof Error ? error.message : ''
      setAddError(
        reason === 'SOLD_OUT'
          ? 'This edition just sold out.'
          : reason.startsWith('ONLY ')
            ? `Sorry, only ${reason.slice('ONLY '.length).replace(' LEFT', '')} left in this edition.`
            : 'Could not add to cart. Please try again.',
      )
      throw error
    }
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
        <EditionBadge editionType="limited" onDetails={() => setIntroOpen(true)} />
        {selected && config ? (
          <>
            <VariantPicker
              variants={pickerItems}
              selectedVariantId={selected.id}
              onSelect={setSelectedVariantId}
            />
            {sceneReady && !isMobile && (
              <Scene
                imageUrl={artwork.imageUrl}
                catalog={catalog}
                config={config}
                configReady
                editionLabel={`1/${selected.editionSize}`}
              />
            )}
            <SummaryPanel
              artwork={artwork}
              catalog={catalog}
              config={config}
              quote={quote}
              quoteLoading={false}
              canContinue
              configReady
              onAddToCart={handleAddToCart}
              onContinueShopping={close}
              editionLabel={`1/${selected.editionSize}`}
              addError={addError}
              isEditing={editLineId !== null}
              isDuplicate={isDuplicate}
            />
          </>
        ) : (
          <div className={styles.soldOutPanel}>
            <p>This limited edition is sold out.</p>
          </div>
        )}
      </main>

      {cartAddedOpen && (
        <CartAddedModal onClose={() => setCartAddedOpen(false)} edited={editLineId !== null} />
      )}

      {introOpen && detailVariant && (
        <Modal onClose={dismissIntro} titleId="print-intro-title" maxWidth="640px">
          <div className={styles.introModal}>
            <Monogram className={styles.introMonogram} aria-hidden="true" />
            <p id="print-intro-title" className={styles.detailLead}>
              <strong>{artwork.title}</strong> by <strong>{artwork.artistName}</strong>.
            </p>
            <div className={styles.detailSections}>
              <p className={styles.detailSubhead}>Terms of sale</p>
              <ul className={styles.detailList}>
                <li>
                  Individually numbered — each print carries its own number in the margin below the
                  image.
                </li>
                <li>
                  Comes with a Certificate of Authenticity (COA), hand-signed by the artist — the
                  signature is on the certificate, not the print.
                </li>
                <li>Sold unframed, on premium archival paper — frame it your way.</li>
                <li>Price might rise as the edition sells.</li>
                <li>Your edition number is allocated at the point of sale.</li>
                <li>Final VAT is calculated when you confirm your delivery address at checkout.</li>
                <li>Sales are strictly limited to one edition per household.</li>
                <li>We reserve the right to cancel or refund an order if needed.</li>
              </ul>
              <p className={styles.detailSubhead}>Shipping</p>
              <ul className={styles.detailList}>
                <li>
                  All editions are packaged to the highest standards, managed at our warehouse using
                  archival materials.
                </li>
                <li>Shipping is calculated at checkout, based on your delivery address.</li>
                <li>Most editions are dispatched within about two weeks of purchase.</li>
                <li>
                  Sent with tracked delivery &mdash; we&rsquo;ll email you the tracking when
                  it&rsquo;s on its way.
                </li>
                <li>
                  Delivery is typically 1&ndash;2 weeks in Europe and 2&ndash;4 weeks
                  internationally (international orders may be subject to customs and local import
                  duties).
                </li>
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
