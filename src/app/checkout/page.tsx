import type { Metadata } from 'next'

import { CartCheckout } from '@/components/checkout/CartCheckout'

export const metadata: Metadata = {
  title: { absolute: 'Checkout · The Art Room' },
  description: 'Enter your shipping details and review your order before paying.',
  robots: { index: false, follow: false },
}

const Checkout = () => {
  return <CartCheckout />
}

export default Checkout
