import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { generateUniqueSlug } from '@/lib/slugify'

// POST batch create artworks (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Require authentication and get effective user ID
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = await request.json()
    const { artworks } = body as {
      artworks: Array<{
        id: string
        name: string
        artworkType: string
        title?: string
        author?: string
        year?: string
        technique?: string
        dimensions?: string
        description?: string
        imageUrl?: string
        textContent?: string
        featured?: boolean
        hiddenFromExhibition?: boolean
        originalWidth?: number | null
        originalHeight?: number | null
      }>
    }

    if (!artworks || !Array.isArray(artworks)) {
      return NextResponse.json({ error: 'artworks array is required' }, { status: 400 })
    }

    // Ownership gate for the upsert's UPDATE branch: the ids are
    // client-supplied, so without this check any signed-in user could pass
    // another artist's artwork id and overwrite their row (the CREATE branch
    // binds userId, but existing rows take the unscoped UPDATE path).
    const existing = await prisma.artwork.findMany({
      where: { id: { in: artworks.map((a) => a.id) } },
      select: { id: true, userId: true },
    })
    const foreign = existing.filter((row) => row.userId !== userId)
    if (foreign.length > 0) {
      return NextResponse.json(
        { error: 'One or more artworks belong to another user', ids: foreign.map((r) => r.id) },
        { status: 403 },
      )
    }

    // Use upsert to avoid duplicates (if artwork already exists, update it)
    const results = await Promise.all(
      artworks.map(async (artwork) => {
        const slug = await generateUniqueSlug(artwork.title || artwork.name || 'Untitled')
        return prisma.artwork.upsert({
          where: { id: artwork.id },
          create: {
            id: artwork.id,
            userId,
            name: artwork.name,
            slug,
            artworkType: artwork.artworkType || 'image',
            title: artwork.title || undefined,
            author: artwork.author || undefined,
            year: artwork.year || undefined,
            technique: artwork.technique || undefined,
            dimensions: artwork.dimensions || undefined,
            description: artwork.description || undefined,
            imageUrl: artwork.imageUrl || undefined,
            textContent: artwork.textContent || undefined,
            featured: artwork.featured ?? false,
            hiddenFromExhibition: artwork.hiddenFromExhibition ?? false,
            originalWidth: artwork.originalWidth ?? undefined,
            originalHeight: artwork.originalHeight ?? undefined,
          },
          update: {
            name: artwork.name,
            artworkType: artwork.artworkType || 'image',
            title: artwork.title || undefined,
            author: artwork.author || undefined,
            year: artwork.year || undefined,
            technique: artwork.technique || undefined,
            dimensions: artwork.dimensions || undefined,
            description: artwork.description || undefined,
            imageUrl: artwork.imageUrl || undefined,
            textContent: artwork.textContent || undefined,
            featured: artwork.featured ?? false,
            hiddenFromExhibition: artwork.hiddenFromExhibition ?? false,
            originalWidth: artwork.originalWidth ?? undefined,
            originalHeight: artwork.originalHeight ?? undefined,
          },
        })
      }),
    )

    // Bust detail page caches for each upserted artwork
    results.forEach((artwork) => {
      revalidateTag(`artwork-${artwork.id}`, 'default')
    })

    return NextResponse.json({ count: results.length, artworks: results }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/artworks/batch] error:', error)
    return NextResponse.json({ error: 'Failed to create artworks' }, { status: 500 })
  }
}
