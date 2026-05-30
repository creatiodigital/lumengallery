import { unstable_cache } from 'next/cache'

import prisma from '@/lib/prisma'

const TITLES: Record<string, string> = {
  about: 'About Us',
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
  accessibility: 'Accessibility Policy',
  'sale-terms': 'Online Terms of Sale',
  prints: 'Prints',
}

const formatSlugToTitle = (slug: string): string =>
  TITLES[slug] || slug.charAt(0).toUpperCase() + slug.slice(1)

/**
 * Reads a CMS page row by slug. Mirrors the upsert-on-miss behavior of
 * /api/pages/[slug] so first-load of a never-edited page returns a
 * stub instead of null. Cache tag matches that route so admin edits
 * (which call `revalidateTag('page-${slug}')`) invalidate this cache too.
 */
export const getStaticPageContent = (slug: string) =>
  unstable_cache(
    async () => {
      let page = await prisma.pageContent.findUnique({ where: { slug } })
      if (!page) {
        page = await prisma.pageContent.create({
          data: {
            slug,
            title: formatSlugToTitle(slug),
            content: '<p>Content coming soon...</p>',
          },
        })
      }
      return page
    },
    [`static-page-content-${slug}`],
    { tags: [`page-${slug}`], revalidate: 86400 },
  )()
