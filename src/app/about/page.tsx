import type { Metadata } from 'next'

import { AboutPage } from '@/components/about'
import { getStaticPageContent } from '@/lib/queries/getStaticPageContent'

// ISR so admin edits show without a redeploy. `revalidatePath` (in the pages
// API) only refreshes a route that opts into ISR via `revalidate`; a fully
// static page is an immutable asset Vercel won't purge on demand. 1h is the
// background fallback. NOT force-dynamic (runtime render 500s in prod — AR-112).
export const revalidate = 3600

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
