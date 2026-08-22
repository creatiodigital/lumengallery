import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintWizard } from '@/components/PrintWizard'
import { PurchasesPausedNotice } from '@/components/checkout/PurchasesPausedNotice'
import { isArtworkPurchasable, LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'
import type { LimitedVariantView } from '@/lib/editions/types'
import { toLimitedVariantView } from '@/lib/editions/toLimitedVariantView'
import prisma from '@/lib/prisma'
import { getPurchasesPaused } from '@/lib/settings'

interface PrintWizardPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PrintWizardPageProps): Promise<Metadata> {
  const { slug } = await params
  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: { title: true, user: { select: { name: true, lastName: true } } },
  })

  if (!artwork) return { title: 'Print order' }

  const artistName = `${artwork.user.name} ${artwork.user.lastName}`
  return {
    title: { absolute: `Order a print — ${artwork.title} by ${artistName}` },
    robots: { index: false, follow: false },
  }
}

const PrintWizardPage = async ({ params }: PrintWizardPageProps) => {
  const { slug } = await params

  // The kill-switch read runs alongside the artwork query (independent) —
  // it covers deep links / bookmarks straight into the wizard while the
  // CTAs that normally lead here are hidden.
  const [paused, artwork] = await Promise.all([
    getPurchasesPaused(),
    prisma.artwork.findUnique({
      where: { slug },
      include: {
        user: { select: { name: true, lastName: true } },
        // Buyers only see published variants that are currently blocked (on
        // sale). An admin-unblocked variant is mid-edit and paused from sale.
        limitedVariants: { where: LIVE_VARIANT_WHERE, orderBy: { order: 'asc' } },
      },
    }),
  ])

  if (paused) {
    return <PurchasesPausedNotice title="Order a print" />
  }

  if (!artwork || !artwork.imageUrl) {
    notFound()
  }
  // A LIMITED edition has no artwork-level price — it is priced per variant, so
  // gating on `printPriceCents` 404'd every limited edition that had never
  // carried a leftover artwork price, even with a live priced variant.
  if (
    !isArtworkPurchasable({
      printEnabled: artwork.printEnabled,
      editionType: artwork.editionType,
      printPriceCents: artwork.printPriceCents,
      liveVariantCount: artwork.limitedVariants.length,
    })
  ) {
    notFound()
  }
  // Missing original pixel dimensions = we can't compute a sharp print
  // ceiling. Refuse to render the wizard so the per-artwork size ticks
  // stay in sync with the canvas sidebar (which renders no marker in
  // the same case) instead of silently using provider-wide bounds.
  if (!artwork.originalWidth || !artwork.originalHeight) {
    notFound()
  }

  const originalWidthPx = artwork.originalWidth
  const originalHeightPx = artwork.originalHeight
  const artistName = `${artwork.user.name} ${artwork.user.lastName}`

  const catalog = await loadProviderCatalog('printspace', {
    imageWidthPx: originalWidthPx,
    imageHeightPx: originalHeightPx,
  })

  const restrictions = (artwork.printOptions as PrintRestrictions | null) ?? null
  const recommendations = (artwork.printRecommendations as PrintRecommendations | null) ?? null

  // For limited editions, resolve each published variant's live stock
  // (count of edition numbers still available) so the wizard can show
  // remaining counts and hide sold-out variants.
  const isLimited = artwork.editionType === 'limited'
  let variants: LimitedVariantView[] = []
  if (isLimited && artwork.limitedVariants.length > 0) {
    const counts = await prisma.editionNumber.groupBy({
      by: ['variantId'],
      where: {
        variantId: { in: artwork.limitedVariants.map((v) => v.id) },
        state: 'available',
      },
      _count: { _all: true },
    })
    const remaining = new Map(counts.map((c) => [c.variantId, c._count._all]))
    variants = artwork.limitedVariants.map((v) => toLimitedVariantView(v, remaining.get(v.id) ?? 0))
  }

  return (
    <PrintWizard
      artwork={{
        id: artwork.id,
        slug: artwork.slug ?? slug,
        title: artwork.title ?? artwork.name,
        artistName,
        year: artwork.year ?? undefined,
        imageUrl: artwork.imageUrl,
        originalWidthPx,
        originalHeightPx,
        // Open editions are priced on the artwork; LIMITED ones carry no
        // artwork price and are quoted per variant, and the open wizard is
        // never rendered for them. `isArtworkPurchasable` above guarantees a
        // non-null price in every case where this value is actually read.
        printPriceCents: artwork.printPriceCents ?? 0,
        editionType: isLimited ? 'limited' : 'open',
        variants,
        editionLimited: artwork.printEditionLimited ?? false,
        editionTotal: artwork.printEditionTotal ?? null,
      }}
      catalog={catalog}
      restrictions={restrictions}
      recommendations={recommendations}
    />
  )
}

export default PrintWizardPage
