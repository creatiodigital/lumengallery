import type { Metadata } from 'next'

import { CartCheckout } from '@/components/checkout/CartCheckout'
import { TPS_SUPPORTED_COUNTRIES } from '@/lib/print-providers/printspace/pricing'

export const metadata: Metadata = {
  title: { absolute: 'Checkout · The Art Room' },
  description: 'Enter your shipping details and review your order before paying.',
  robots: { index: false, follow: false },
}

const Checkout = () => {
  // Restrict the address form to the provider's shippable countries (the same
  // set the server-side validation enforces) so a buyer can't pick an
  // unshippable destination and hit a rejection. Single provider today.
  return <CartCheckout supportedCountries={TPS_SUPPORTED_COUNTRIES} />
}

export default Checkout
