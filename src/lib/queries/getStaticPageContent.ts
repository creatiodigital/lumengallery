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
 * stub instead of null.
 *
 * Intentionally NOT wrapped in unstable_cache. On Vercel that Data Cache
 * is persistent and survives redeploys with its 24h TTL, and Next 16's
 * revalidateTag doesn't reliably purge the legacy unstable_cache — so
 * admin edits didn't appear even after a redeploy. The page is still
 * statically rendered; the pages API purges its route via revalidatePath
 * on save, and the regeneration now reads fresh data straight from the DB.
 */
export const getStaticPageContent = async (slug: string) => {
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
}
