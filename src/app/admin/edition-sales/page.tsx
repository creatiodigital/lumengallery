import type { Metadata } from 'next'

import { AdminEditionSales } from '@/components/admin/edition-sales'

export const metadata: Metadata = {
  title: { absolute: 'Limited edition sales — The Art Room Admin' },
  robots: { index: false, follow: false },
}

const AdminEditionSalesPage = () => <AdminEditionSales />

export default AdminEditionSalesPage
