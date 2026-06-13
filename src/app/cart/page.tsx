import type { Metadata } from 'next'

import { CartPage } from '@/components/cart/CartPage'

export const metadata: Metadata = {
  title: { absolute: 'Cart · The Art Room' },
  description: 'Review the prints in your cart before checking out.',
}

const Cart = () => {
  return <CartPage />
}

export default Cart
