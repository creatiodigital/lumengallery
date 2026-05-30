import type { Metadata } from 'next'

import { AccessibilityPage } from '@/components/accessibility'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// Render per-request so admin edits to this CMS page appear immediately.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Accessibility Policy' },
  description: 'Accessibility commitment and policies for The Art Room platform.',
}

export default async function Page() {
  const page = await getStaticPageContent('accessibility')
  return <AccessibilityPage content={page.content} />
}
