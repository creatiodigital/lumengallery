import type { Metadata } from 'next'

import { AboutPage } from '@/components/about'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// Render per request so admin edits show immediately. Safe now that <RichText>
// sanitizes with sanitize-html (pure JS) instead of isomorphic-dompurify
// (jsdom) — the jsdom render at runtime is what previously 500'd these pages.
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
