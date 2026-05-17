import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintCheckout } from '@/components/checkout/PrintCheckout'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import prisma from '@/lib/prisma'

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

  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!artwork || !artwork.imageUrl) notFound()
  if (!artwork.printEnabled || !artwork.printPriceCents) notFound()
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
        printPriceCents: artwork.printPriceCents,
      }}
      providerId="printspace"
      supportedCountries={catalog.supportedCountries}
      initialCountry={initialCountry}
    />
  )
}

export default CheckoutPage
