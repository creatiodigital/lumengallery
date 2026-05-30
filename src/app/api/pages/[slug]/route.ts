import { NextResponse } from 'next/server'
import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/authUtils'
import { PAGE_ROUTE_BY_SLUG } from '@/lib/cms/pageRoutes'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ slug: string }> }

// GET page content by slug (public)
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params

    const getCachedPage = unstable_cache(
      async () => {
        let page = await prisma.pageContent.findUnique({
          where: { slug },
        })

        // Create page with default content if it doesn't exist
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
      [`page-${slug}`],
      { tags: [`page-${slug}`], revalidate: 86400 },
    )

    const page = await getCachedPage()
    return NextResponse.json(page)
  } catch (error) {
    console.error('Error fetching page:', error)
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 })
  }
}

// PUT update page content (admin only)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    // Require admin role
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { slug } = await params
    const body = await request.json()
    const { title, content } = body

    const page = await prisma.pageContent.upsert({
      where: { slug },
      update: { title, content },
      create: { slug, title, content },
    })

    // Purge both caches the page can be served from:
    //  - revalidateTag: the GET /api/pages/[slug] data cache (tagged).
    //  - revalidatePath: the statically-prerendered public page's Full
    //    Route Cache. The public page reads getStaticPageContent directly
    //    (untagged), so the tag alone never purges it — this is what made
    //    edits invisible in prod until a redeploy. Slug ≠ route, so map it.
    revalidateTag(`page-${slug}`, 'default')
    const route = PAGE_ROUTE_BY_SLUG[slug]
    if (route) revalidatePath(route)

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error updating page:', error)
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 })
  }
}

function formatSlugToTitle(slug: string): string {
  const titles: Record<string, string> = {
    about: 'About Us',
    terms: 'Terms and Conditions',
    privacy: 'Privacy Policy',
    accessibility: 'Accessibility Policy',
    'sale-terms': 'Online Terms of Sale',
    prints: 'Prints',
  }
  return titles[slug] || slug.charAt(0).toUpperCase() + slug.slice(1)
}
