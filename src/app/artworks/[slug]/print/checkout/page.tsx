import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintCheckout } from '@/components/checkout/PrintCheckout'
import { PurchasesPausedNotice } from '@/components/checkout/PurchasesPausedNotice'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { isArtworkPurchasable, LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import prisma from '@/lib/prisma'
import { getPurchasesPaused } from '@/lib/settings'

interface CheckoutPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: { absolute: 'Checkout — The Art Room' },
  robots: { index: false, follow: false },
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

const CheckoutPage = async ({ params, searchParams }: CheckoutPageProps) => {
  const { slug } = await params
  const sp = await searchParams

  // Kill-switch read runs alongside the artwork query (independent) —
  // covers deep links into the single-print checkout.
  const [paused, artwork] = await Promise.all([
    getPurchasesPaused(),
    prisma.artwork.findUnique({
      where: { slug },
      include: {
        user: { select: { name: true, lastName: true } },
        // Live priced variants — what makes a LIMITED edition purchasable.
        _count: { select: { limitedVariants: { where: LIVE_VARIANT_WHERE } } },
      },
    }),
  ])

  if (paused) {
    return <PurchasesPausedNotice title="Checkout" />
  }

  if (!artwork || !artwork.imageUrl) notFound()
  // Limited editions are priced PER VARIANT and carry no artwork-level price;
  // gating on `printPriceCents` closed the flow for every one of them.
  if (
    !isArtworkPurchasable({
      printEnabled: artwork.printEnabled,
      editionType: artwork.editionType,
      printPriceCents: artwork.printPriceCents,
      liveVariantCount: artwork._count.limitedVariants,
    })
  )
    notFound()
  // Stay in sync with the wizard entry — no original dims means we
  // can't compute a sharp print ceiling, so the print flow is closed.
  if (!artwork.originalWidth || !artwork.originalHeight) notFound()

  const initialCountry = pickString(sp.country) ?? ''
  const artistName = `${artwork.user.name} ${artwork.user.lastName}`

  // Load catalog for the country dropdown — every supported destination
  // is offered. Buyer picks here (no longer pre-locked from the wizard).
  const catalog = await loadProviderCatalog('printspace', {
    imageWidthPx: artwork.originalWidth,
    imageHeightPx: artwork.originalHeight,
  })

  return (
    <PrintCheckout
      artwork={{
        slug: artwork.slug ?? slug,
        title: artwork.title ?? artwork.name,
        artistName,
        year: artwork.year ?? undefined,
        imageUrl: artwork.imageUrl,
        originalWidthPx: artwork.originalWidth,
        originalHeightPx: artwork.originalHeight,
        // Open editions are priced on the artwork; LIMITED ones carry no
        // artwork price and are quoted per variant, and the open wizard is
        // never rendered for them. `isArtworkPurchasable` above guarantees a
        // non-null price in every case where this value is actually read.
        printPriceCents: artwork.printPriceCents ?? 0,
      }}
      providerId="printspace"
      supportedCountries={catalog.supportedCountries}
      initialCountry={initialCountry}
    />
  )
}

export default CheckoutPage
