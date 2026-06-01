import type { Metadata } from 'next'

import { TermsPage } from '@/components/terms'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// Render per request and read straight from the DB so admin edits appear
// immediately. Verified on staging: server-side <RichText> (isomorphic-
// dompurify) renders at runtime without the AR-112 500 — the artwork and
// exhibition pages already do the same in prod. No cache, no revalidation.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Terms and Conditions' },
  description: 'Terms and conditions for using The Art Room platform.',
}

export default async function Page() {
  const page = await getStaticPageContent('terms')
  return <TermsPage content={page.content} />
}
