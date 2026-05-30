import type { Metadata } from 'next'

import { TermsOfSalePage } from '@/components/terms-of-sale'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

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
