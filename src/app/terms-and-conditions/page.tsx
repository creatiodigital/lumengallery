import type { Metadata } from 'next'

import { TermsPage } from '@/components/terms'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// Render per-request so admin edits to this CMS page appear immediately.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Terms and Conditions' },
  description: 'Terms and conditions for using The Art Room platform.',
}

export default async function Page() {
  const page = await getStaticPageContent('terms')
  return <TermsPage content={page.content} />
}
