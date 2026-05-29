import { NextResponse } from 'next/server'
import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ slug: string }> }

// CMS slugs are statically prerendered under different route paths, so
// revalidating the data tag alone doesn't refresh the published page.
// We also revalidate the route path so admin edits go live immediately.
const SLUG_TO_PATH: Record<string, string> = {
  privacy: '/privacy-policy',
  terms: '/terms-and-conditions',
  'sale-terms': '/terms-of-sale',
  accessibility: '/accessibility-policy',
  prints: '/prints',
}

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

    // Revalidate the data cache and the prerendered route so the edit
    // shows immediately instead of waiting for the 24h ISR window.
    revalidateTag(`page-${slug}`, 'default')
    const path = SLUG_TO_PATH[slug]
    if (path) revalidatePath(path)

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
