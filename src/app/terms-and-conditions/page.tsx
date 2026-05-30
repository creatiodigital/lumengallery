import type { Metadata } from 'next'

import { TermsPage } from '@/components/terms'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Terms and Conditions' },
  description: 'Terms and conditions for using The Art Room platform.',
}

export default async function Page() {
  const page = await getStaticPageContent('terms')
  return <TermsPage content={page.content} />
}
