import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/authUtils'
import { PAGE_ROUTE_BY_SLUG } from '@/lib/cms/pageRoutes'
import { MAX_UPLOAD_SIZE } from '@/lib/imageConfig'
import { processImage, isValidImageType } from '@/lib/imageProcessor'
import prisma from '@/lib/prisma'
import { buildPageBannerImageKey, deleteFromR2, uploadToR2 } from '@/lib/r2'

type RouteParams = { params: Promise<{ slug: string }> }

const MAX_FILE_SIZE = MAX_UPLOAD_SIZE

// POST — upload a banner image for a page (admin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { slug } = await params

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 1MB.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!isValidImageType(buffer)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.' },
        { status: 400 },
      )
    }

    const processed = await processImage(buffer)

    // Fetch current banner (if any) so we can delete it after the new one
    // uploads successfully — don't orphan R2 objects.
    const existing = await prisma.pageContent.findUnique({
      where: { slug },
      select: { bannerImageUrl: true },
    })

    const key = buildPageBannerImageKey(slug)
    const url = await uploadToR2(key, processed, 'image/webp')

    await prisma.pageContent.upsert({
      where: { slug },
      update: { bannerImageUrl: url },
      create: {
        slug,
        title: slug.charAt(0).toUpperCase() + slug.slice(1),
        content: '<p>Content coming soon...</p>',
        bannerImageUrl: url,
      },
    })

    if (existing?.bannerImageUrl) {
      try {
        await deleteFromR2(existing.bannerImageUrl)
      } catch (err) {
        console.warn('[POST /api/pages/[slug]/image] failed to delete old banner:', err)
      }
    }

    revalidateTag(`page-${slug}`, 'default')
    const route = PAGE_ROUTE_BY_SLUG[slug]
    if (route) revalidatePath(route)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[POST /api/pages/[slug]/image] error:', error)
    return NextResponse.json({ error: 'Failed to upload banner' }, { status: 500 })
  }
}

// DELETE — remove the banner image for a page (admin only)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { slug } = await params
    const existing = await prisma.pageContent.findUnique({
      where: { slug },
      select: { bannerImageUrl: true },
    })

    if (existing?.bannerImageUrl) {
      try {
        await deleteFromR2(existing.bannerImageUrl)
      } catch (err) {
        console.warn('[DELETE /api/pages/[slug]/image] failed to delete banner blob:', err)
      }
    }

    await prisma.pageContent.update({
      where: { slug },
      data: { bannerImageUrl: null },
    })

    revalidateTag(`page-${slug}`, 'default')
    const route = PAGE_ROUTE_BY_SLUG[slug]
    if (route) revalidatePath(route)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/pages/[slug]/image] error:', error)
    return NextResponse.json({ error: 'Failed to remove banner' }, { status: 500 })
  }
}
