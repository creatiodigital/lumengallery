import type { Metadata } from 'next'

import { CartCheckout } from '@/components/checkout/CartCheckout'
import { PurchasesPausedNotice } from '@/components/checkout/PurchasesPausedNotice'
import { TPS_SUPPORTED_COUNTRIES } from '@/lib/print-providers/printspace/pricing'
import { getPurchasesPaused } from '@/lib/settings'

export const metadata: Metadata = {
  title: { absolute: 'Checkout · The Art Room' },
  description: 'Enter your shipping details and review your order before paying.',
  robots: { index: false, follow: false },
}

// Read the kill switch per request — never serve a cached verdict.
export const dynamic = 'force-dynamic'

interface CheckoutPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const Checkout = async ({ searchParams }: CheckoutPageProps) => {
  const sp = await searchParams

  // Purchases kill switch — but let a 3DS return through: Stripe sends the
  // buyer back here with ?payment_intent=… AFTER authorizing, and that
  // payment is one of the "ongoing ones" that should complete its
  // confirmation screen even while new purchases are paused.
  const isPaymentReturn = typeof sp.payment_intent === 'string'
  if (!isPaymentReturn && (await getPurchasesPaused())) {
    return <PurchasesPausedNotice title="Checkout" />
  }

  // Restrict the address form to the provider's shippable countries (the same
  // set the server-side validation enforces) so a buyer can't pick an
  // unshippable destination and hit a rejection. Single provider today.
  return <CartCheckout supportedCountries={TPS_SUPPORTED_COUNTRIES} />
}

export default Checkout
