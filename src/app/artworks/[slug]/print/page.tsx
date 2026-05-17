import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintWizard } from '@/components/PrintWizard'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'
import prisma from '@/lib/prisma'

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

  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!artwork || !artwork.imageUrl) {
    notFound()
  }
  if (!artwork.printEnabled || !artwork.printPriceCents) {
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

  return (
    <PrintWizard
      artwork={{
        slug: artwork.slug ?? slug,
        title: artwork.title ?? artwork.name,
        artistName,
        year: artwork.year ?? undefined,
        imageUrl: artwork.imageUrl,
        originalWidthPx,
        originalHeightPx,
        printPriceCents: artwork.printPriceCents,
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
