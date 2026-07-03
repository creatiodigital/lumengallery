import type { Metadata } from 'next'

import { AdminInvoices } from '@/components/admin/invoices'

export const metadata: Metadata = {
  title: { absolute: 'Invoice Register — The Art Room Admin' },
  robots: { index: false, follow: false },
}

const AdminInvoicesPage = () => <AdminInvoices />

export default AdminInvoicesPage
