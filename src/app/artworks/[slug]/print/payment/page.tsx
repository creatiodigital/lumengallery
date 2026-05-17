import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintPayment } from '@/components/checkout/PrintPayment'
import prisma from '@/lib/prisma'

interface PaymentPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: { absolute: 'Payment — The Art Room' },
  robots: { index: false, follow: false },
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

const PaymentPage = async ({ params, searchParams }: PaymentPageProps) => {
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

  const country = pickString(sp.country) ?? ''
  const artistName = `${artwork.user.name} ${artwork.user.lastName}`

  return (
    <PrintPayment
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
      country={country}
    />
  )
}

export default PaymentPage
