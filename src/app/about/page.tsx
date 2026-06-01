import type { Metadata } from 'next'

import { AboutPage } from '@/components/about'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// Render per request and read straight from the DB so admin edits appear
// immediately. Verified on staging: server-side <RichText> (isomorphic-
// dompurify) renders at runtime without the AR-112 500 — the artwork and
// exhibition pages already do the same in prod. No cache, no revalidation.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'About The Art Room' },
  description:
    'Learn about The Art Room — a virtual exhibition space dedicated to showcasing contemporary art in immersive 3D environments.',
}

const About = async () => {
  const page = await getStaticPageContent('about')
  return <AboutPage content={page.content} />
}

export default About
