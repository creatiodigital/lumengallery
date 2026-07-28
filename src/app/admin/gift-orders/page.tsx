import type { Metadata } from 'next'

import { AdminGiftOrders } from '@/components/admin/gift-orders'

export const metadata: Metadata = {
  title: { absolute: 'Gift orders — The Art Room Admin' },
  robots: { index: false, follow: false },
}

const AdminGiftOrdersPage = () => <AdminGiftOrders />

export default AdminGiftOrdersPage
