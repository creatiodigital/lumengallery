'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { CartIcon } from '@/components/cart/CartIcon'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { clearPrintSession } from '@/components/checkout/clearPrintSession'
import { consumePrintReturnUrl } from '@/components/checkout/printReturnUrl'
import Logo from '@/icons/logo.svg'
import Monogram from '@/icons/monogram.svg'

import { buildCartItem } from '@/lib/cart/buildCartItem'
import { useCart } from '@/lib/cart/useCart'
import { type Catalog, type Quote, summarizeConfig } from '@/lib/print-providers'
import { getProviderQuote } from '@/lib/print-providers/quote'
import { variantToWizardConfig } from '@/lib/editions/variantToWizardConfig'
import { cartedVariantIds, resolveSelectedVariant } from '@/lib/editions/variantSelection'
import { TABLET_BREAKPOINT_PX, useIsMobile } from '@/hooks/useIsMobile'

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
  // Desktop-only 3D preview — same rationale and breakpoint as the open
  // wizard: never mount the WebGL canvas on mobile, and only mount it after
  // hydration so SSR and the first client render agree.
  const isMobile = useIsMobile(TABLET_BREAKPOINT_PX + 1)
  const [sceneReady, setSceneReady] = useState(false)
  useEffect(() => {
    setSceneReady(true)
  }, [])
  // NOTE: the cart shows no "Edit item" for a limited line and this wizard
  // reads no `editLineId` / `variant` param. Nothing here edits a line — see
  // the "marked, not locked" comment below.

  const { addItem, items } = useCart()

  // Sold-out variants are hidden — only buyable ones are offered.
  const available = useMemo(
    () => (artwork.variants ?? []).filter((v) => v.remaining > 0),
    [artwork.variants],
  )

  // A variant already in the cart is MARKED, not locked.
  //
  // Selecting is how an edition gets hung on the wall in the 3D preview, and a
  // buyer coming back for a last look at what they bought must not lose that as
  // a side effect of buying it. What a carted variant loses is only the add —
  // the cart offers no edit for a limited line and no second copy of one, the
  // variant being the object rather than a configuration of it.
  const cartedIds = useMemo(() => cartedVariantIds(items, artwork.id), [items, artwork.id])

  // One edition at a time, and always one: the preview, the schema and the spec
  // list all describe exactly one print, and the panel has nothing to say
  // without it. `resolveSelectedVariant` supplies the opening default, so this
  // starts empty and is filled by the buyer's first click. Picking another
  // switches; there is no unselecting.
  const [selectedId, setSelectedId] = useState('')
  const [country] = useState<string>(() => readCountryFromStash(artwork.slug))

  // Edition-details modal — opened ONLY when the buyer clicks "See Details" on
  // the persistent edition badge. No auto-show: the badge keeps the edition
  // type visible at all times, without interrupting the buyer.
  const [introOpen, setIntroOpen] = useState(false)
  const dismissIntro = () => setIntroOpen(false)

  // Re-resolved every render: it supplies the opening selection, and moves off
  // an edition that sells out under a selection left sitting there before it
  // can reach the preview or the add.
  const selected = useMemo(
    () => resolveSelectedVariant(selectedId, available),
    [selectedId, available],
  )
  // Already bought: the card stays selectable so it can be looked at again, but
  // the panel offers "Go to cart" in place of an add.
  const selectedInCart = !!selected && cartedIds.has(selected.id)
  // For the details modal: fall back to any variant (incl. sold-out) so the
  // edition-size text still renders when nothing is selected.
  const detailVariant = selected ?? artwork.variants?.[0] ?? null

  const config = useMemo(() => (selected ? variantToWizardConfig(selected) : null), [selected])

  // The mark stays in the preview — it is part of what the buyer is buying, and
  // showing where it sits on the sheet matters. It is ILLUSTRATIVE: nothing is
  // reserved before payment, so the real number is unknown here. The terms say
  // so ("the number shown in the preview is for reference only"), which is what
  // stops "1/100" reading as a promise of the first copy.
  const editionLabel = selected ? `1/${selected.editionSize}` : undefined

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

  // One quote per variant, keyed by id. The picker needs a price on every card
  // and an add commits several lines at once, so both read from here rather
  // than re-quoting per render or per click.
  const quotesByVariantId = useMemo(() => {
    const quotes = new Map<string, Quote>()
    for (const v of available) {
      quotes.set(
        v.id,
        getProviderQuote(catalog.providerId, {
          config: variantToWizardConfig(v),
          country,
          artistPriceCents: v.priceCents ?? artwork.printPriceCents,
        }),
      )
    }
    return quotes
  }, [available, country, catalog.providerId, artwork.printPriceCents])

  const pickerItems: VariantPickerItem[] = useMemo(
    () =>
      available.map((v) => ({
        ...v,
        priceCents: quotesByVariantId.get(v.id)?.subtotalCents ?? 0,
      })),
    [available, quotesByVariantId],
  )

  const [addError, setAddError] = useState<string | null>(null)

  // Clear any stale add error when the selection changes — the previous
  // sold-out message no longer applies to what is chosen now.
  useEffect(() => {
    setAddError(null)
  }, [selectedId])

  const close = () => {
    clearPrintSession(artwork.slug)
    router.push(consumePrintReturnUrl(artwork.slug) ?? '/prints')
  }

  const handleAddToCart = async () => {
    if (!selected || !config || !quote || selectedInCart) return

    setAddError(null)

    // Always an ADD, never a replace — nothing here edits an existing line.
    // `addItem` commits the line locally; stock is settled once, atomically,
    // when payment starts. Re-throw on failure so the panel does not flip to
    // its "added" state.
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
        quantity: 1,
      })
      // Straight to the cart. A limited edition is one numbered copy of one
      // work — nobody arrives here to browse on, and offering "Continue
      // shopping" beside "Go to cart" made walking away look like an ordinary
      // next step. The cart is where the price and checkout live, so it IS the
      // next page.
      router.push('/cart')
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
        {/* The caveat rides on the badge, before anything is chosen — there is
            no hold and no clock, so the one thing the buyer must know up front
            is that taking their time carries a risk. */}
        <EditionBadge
          editionType="limited"
          onDetails={() => setIntroOpen(true)}
          note="Not reserved until you pay — another collector may take it first."
        />
        {available.length > 0 ? (
          <>
            <VariantPicker
              variants={pickerItems}
              selectedVariantId={selected?.id ?? ''}
              onSelect={setSelectedId}
              cartedVariantIds={cartedIds}
            />
            {/* The wall is the reason to select at all. Nothing chosen yet,
                nothing to hang. */}
            {sceneReady && !isMobile && selected && config && (
              <Scene
                imageUrl={artwork.imageUrl}
                catalog={catalog}
                config={config}
                configReady
                editionLabel={editionLabel}
              />
            )}
            {selected && config && (
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
                editionLabel={editionLabel}
                navigatesAfterAdd
                alreadyInCart={selectedInCart}
                addError={addError}
                isDuplicate={selectedInCart}
              />
            )}
          </>
        ) : (
          <div className={styles.soldOutPanel}>
            <p>This limited edition is sold out.</p>
          </div>
        )}
      </main>

      {introOpen && detailVariant && (
        <Modal onClose={dismissIntro} titleId="print-intro-title" maxWidth="640px">
          <div className={styles.introModal}>
            <Monogram className={styles.introMonogram} aria-hidden="true" />
            {/* Not shown: the buyer is already on this artwork's page, so the
                line only restated what sits behind the modal. It stays in the
                markup, visually hidden, because `titleId` points at it for the
                dialog's accessible name. */}
            <p id="print-intro-title" className="sr-only">
              {artwork.title} by {artwork.artistName}
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
                <li>
                  Your edition number is allocated at the point of sale — the number shown in the
                  preview is for reference only.
                </li>
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
                <li>Most editions are dispatched within about a week of purchase.</li>
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
