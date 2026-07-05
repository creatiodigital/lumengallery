import type { Metadata } from 'next'

import { CartPage } from '@/components/cart/CartPage'
import { PurchasesPausedNotice } from '@/components/checkout/PurchasesPausedNotice'
import { getPurchasesPaused } from '@/lib/settings'

export const metadata: Metadata = {
  title: { absolute: 'Cart · The Art Room' },
  description: 'Review the prints in your cart before checking out.',
}

// Read the kill switch per request — never serve a cached verdict.
export const dynamic = 'force-dynamic'

const Cart = async () => {
  // Purchases kill switch. The buyer's cart data itself is untouched —
  // items reappear intact when purchases resume.
  if (await getPurchasesPaused()) {
    return <PurchasesPausedNotice title="Cart" />
  }
  return <CartPage />
}

export default Cart
