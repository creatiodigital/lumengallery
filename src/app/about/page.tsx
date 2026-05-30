import type { Metadata } from 'next'

import { AboutPage } from '@/components/about'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// Render per-request so admin edits to this CMS page appear immediately.
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
