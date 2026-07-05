import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintPayment } from '@/components/checkout/PrintPayment'
import { PurchasesPausedNotice } from '@/components/checkout/PurchasesPausedNotice'
import prisma from '@/lib/prisma'
import { getPurchasesPaused } from '@/lib/settings'

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

  // Purchases kill switch — deep links straight to the payment step. The
  // 3DS return lands on /print/confirmation (left open), so an in-flight
  // authorization still completes its confirmation screen.
  if (await getPurchasesPaused()) {
    return <PurchasesPausedNotice title="Payment" />
  }

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
