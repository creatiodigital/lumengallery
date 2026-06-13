'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

  // Sold-out variants are hidden — only buyable ones are offered.
  const available = useMemo(
    () => (artwork.variants ?? []).filter((v) => v.remaining > 0),
    [artwork.variants],
  )
  const [selectedVariantId, setSelectedVariantId] = useState(available[0]?.id ?? '')
  const [country] = useState<string>(() => readCountryFromStash(artwork.slug))

  // Intro modal — shown once per artwork (localStorage gate), explaining
  // what a limited edition entails before the buyer picks a variant.
  const introSeenKey = `print-intro-seen:${artwork.slug}`
  const [introOpen, setIntroOpen] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem(introSeenKey) === 'true') return
    } catch {
      // localStorage unavailable — just show it.
    }
    setIntroOpen(true)
  }, [introSeenKey])
  const dismissIntro = () => {
    setIntroOpen(false)
    try {
      localStorage.setItem(introSeenKey, 'true')
    } catch {
      // Non-fatal.
    }
  }

  const selected = available.find((v) => v.id === selectedVariantId) ?? available[0] ?? null

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

  const { addItem } = useCart()
  const [addError, setAddError] = useState<string | null>(null)

  // Clear any stale add error when the buyer switches variant — the previous
  // sold-out message no longer applies to the new selection.
  useEffect(() => {
    setAddError(null)
  }, [selectedVariantId])

  const close = () => {
    clearPrintSession(artwork.slug)
    router.push(consumePrintReturnUrl(artwork.slug) ?? '/prints')
  }

  const handleAddToCart = async () => {
    if (!selected || !config || !quote) return

    setAddError(null)

    // `addItem` reserves the edition number server-side BEFORE committing the
    // line; on sold-out / insufficient stock it throws so we surface a
    // friendly message and leave the cart untouched. Re-throw so SummaryPanel
    // does not flip to its "added" state.
    try {
      await addItem(
        buildCartItem({
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
          config,
          quote,
          artistCents: selected.priceCents ?? artwork.printPriceCents,
          specsSummary: summarizeConfig(catalog, config),
        }),
      )
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
        <Button
          variant="ghost"
          onClick={close}
          label="CLOSE"
          iconRight={<Icon name="close" size={16} />}
          className={styles.closeButton}
          aria-label="Close wizard"
        />
      </header>

      <main className={styles.body}>
        {selected && config ? (
          <>
            <VariantPicker
              variants={pickerItems}
              selectedVariantId={selected.id}
              onSelect={setSelectedVariantId}
            />
            <Scene
              imageUrl={artwork.imageUrl}
              catalog={catalog}
              config={config}
              configReady
              editionLabel={`1/${selected.editionSize}`}
            />
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
            />
          </>
        ) : (
          <div className={styles.soldOutPanel}>
            <p>This limited edition is sold out.</p>
          </div>
        )}
      </main>

      {introOpen && selected && (
        <Modal onClose={dismissIntro} titleId="print-intro-title">
          <div className={styles.introModal}>
            <Monogram className={styles.introMonogram} aria-hidden="true" />
            <p id="print-intro-title" className={styles.introBody}>
              <strong>{artwork.title}</strong> by <strong>{artwork.artistName}</strong> is a{' '}
              <strong>limited edition</strong>. Every print in this edition is:
            </p>
            <ul className={styles.introList}>
              <li>
                <strong>Hand-numbered</strong> (e.g. 1/{selected.editionSize}) just below the image,
                and <strong>signed by the artist</strong>.
              </li>
              <li>
                Sold <strong>unframed</strong> — all our limited editions ship unframed on premium
                archival paper, so you can frame it your way.
              </li>
              <li>
                Accompanied by a <strong>Certificate of Authenticity</strong>.
              </li>
            </ul>
            <p className={styles.introEdition}>
              Once the edition sells out, it&apos;s closed for good.
            </p>
            <div className={styles.introActions}>
              <Button variant="primary" label="Continue" onClick={dismissIntro} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
