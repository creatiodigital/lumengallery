import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AdminEditionSales } from '@/components/admin/edition-sales'

export const metadata: Metadata = {
  title: { absolute: 'Limited edition sales — The Art Room Admin' },
  robots: { index: false, follow: false },
}

// AdminEditionSales reads `useSearchParams()` internally (the ?gift=<variantId>
// deep link from a variant card), which forces Next.js to require a Suspense
// boundary so prerender can bail out cleanly.
const AdminEditionSalesPage = () => (
  <Suspense fallback={null}>
    <AdminEditionSales />
  </Suspense>
)

export default AdminEditionSalesPage
