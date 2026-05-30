import type { Metadata } from 'next'

import { PrivacyPage } from '@/components/privacy'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// Render per-request so admin edits to this CMS page appear immediately.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Privacy Policy' },
  description: 'Privacy policy for The Art Room platform.',
}

export default async function Page() {
  const page = await getStaticPageContent('privacy')
  return <PrivacyPage content={page.content} />
}
