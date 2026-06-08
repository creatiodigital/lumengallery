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

  const config = useMemo(
    () => (selected ? variantToWizardConfig(selected) : null),
    [selected],
  )

  const quote: Quote | null = useMemo(
    () =>
      config
        ? getProviderQuote(catalog.providerId, {
            config,
            country,
            artistPriceCents: artwork.printPriceCents,
          })
        : null,
    [config, country, catalog.providerId, artwork.printPriceCents],
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
          artistPriceCents: artwork.printPriceCents,
        }).subtotalCents,
      })),
    [available, country, catalog.providerId, artwork.printPriceCents],
  )

  const close = () => {
    clearPrintSession(artwork.slug)
    router.push(consumePrintReturnUrl(artwork.slug) ?? '/prints')
  }

  const handleAddToCart = () => {
    if (!selected || !config || !quote) return
    const specs = summarizeConfig(catalog, config)
    try {
      sessionStorage.setItem(
        `print-quote:${artwork.slug}`,
        JSON.stringify({
          providerId: catalog.providerId,
          config,
          country,
          quote,
          specs,
          variantId: selected.id,
        }),
      )
    } catch {
      // Non-fatal — checkout re-quotes.
    }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(config.values)) params.set(key, value)
    if (config.customSize) {
      params.set('customSize', `${config.customSize.widthCm}x${config.customSize.heightCm}`)
    }
    if (config.borders) {
      for (const [borderId, b] of Object.entries(config.borders)) {
        params.set(borderId, String(b.allCm))
      }
    }
    if (country) params.set('country', country)
    params.set('provider', catalog.providerId)
    params.set('variantId', selected.id)
    router.push(`/artworks/${artwork.slug}/print/checkout?${params.toString()}`)
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
              country={country}
              quote={quote}
              quoteLoading={false}
              canContinue
              configReady
              onAddToCart={handleAddToCart}
              editionLabel={`1/${selected.editionSize}`}
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
              <strong>limited edition</strong>. Each copy is:
            </p>
            <ul className={styles.introList}>
              <li>
                <strong>Numbered</strong> (e.g. 1/{selected.editionSize}) on the front, bottom-left.
              </li>
              <li>
                Shipped <strong>unframed</strong> — rolled or flat — so it arrives safely and you can
                frame it your way.
              </li>
              <li>
                Printed on <strong>premium archival paper</strong> by a specialist fine-art lab, with
                a certificate of authenticity.
              </li>
            </ul>
            <p className={styles.introEdition}>
              Once an edition sells out, it&apos;s closed for good.
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
