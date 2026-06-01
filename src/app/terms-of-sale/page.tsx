import type { Metadata } from 'next'

import { TermsOfSalePage } from '@/components/terms-of-sale'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// ISR so admin edits show without a redeploy. `revalidatePath` (in the pages
// API) only refreshes a route that opts into ISR via `revalidate`; a fully
// static page is an immutable asset Vercel won't purge on demand. 1h is the
// background fallback. NOT force-dynamic (runtime render 500s in prod — AR-112).
export const revalidate = 3600

export const metadata: Metadata = {
  title: { absolute: 'Online Terms of Sale — The Art Room' },
  description:
    'The terms and conditions that apply when you purchase a printed artwork from The Art Room.',
}

const TermsOfSale = async () => {
  const page = await getStaticPageContent('sale-terms')
  return <TermsOfSalePage content={page.content} />
}

export default TermsOfSale
