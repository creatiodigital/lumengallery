import type { Metadata } from 'next'

import { PrivacyPage } from '@/components/privacy'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// ISR so admin edits show without a redeploy. `revalidatePath` (in the pages
// API) only refreshes a route that opts into ISR via `revalidate`; a fully
// static page is an immutable asset Vercel won't purge on demand. 1h is the
// background fallback. NOT force-dynamic (runtime render 500s in prod — AR-112).
export const revalidate = 3600

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Privacy Policy' },
  description: 'Privacy policy for The Art Room platform.',
}

export default async function Page() {
  const page = await getStaticPageContent('privacy')
  return <PrivacyPage content={page.content} />
}
