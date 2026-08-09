import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireOwnership } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * Reusable variant templates for a limited-edition artwork — the same
 * artist's variants from their OTHER artworks, so a spec like
 * "30×45 Canson Baryta, 8 cm border, /100" is defined once and applied
 * again per photo instead of being retyped.
 *
 * Ratio-aware: variant sizes are locked to their artwork's aspect ratio,
 * so only variants whose source artwork matches this artwork's ratio
 * (within a small tolerance, same orientation) are offered. Identical
 * specs appearing on several artworks are deduped to one template.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      select: { userId: true, originalWidth: true, originalHeight: true },
    })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })

    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    if (!artwork.originalWidth || !artwork.originalHeight) {
      return NextResponse.json({ templates: [] })
    }

    const variants = await prisma.limitedVariant.findMany({
      where: {
        artworkId: { not: id },
        artwork: { userId: artwork.userId, editionType: 'limited' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        name: true,
        paperId: true,
        widthCm: true,
        heightCm: true,
        borderCm: true,
        editionSize: true,
        priceCents: true,
        artwork: { select: { title: true, originalWidth: true, originalHeight: true } },
      },
    })

    // EXACT aspect-ratio match — no tolerance, no adaptation (Eduardo,
    // 2026-07-25): a template must apply VERBATIM (identical print size,
    // identical border, identical paper geometry across the series) or not
    // be offered at all. A near-miss ratio would silently change the margin
    // proportions. Integer cross-multiplication avoids float noise; pixel
    // RESOLUTION is deliberately ignored (a 3000×2000 and a 6000×4000 file
    // are both exactly 3:2 — same print geometry; resolution only gates the
    // max printable size, which variant validation already enforces).
    const tw = artwork.originalWidth
    const th = artwork.originalHeight
    const seen = new Set<string>()
    const templates = variants
      .filter((v) => {
        const w = v.artwork.originalWidth
        const h = v.artwork.originalHeight
        if (!w || !h) return false
        return w * th === h * tw
      })
      .filter((v) => {
        const key = `${v.name}|${v.paperId}|${v.widthCm}x${v.heightCm}|${v.borderCm}|${v.editionSize}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((v) => ({
        name: v.name,
        paperId: v.paperId,
        widthCm: v.widthCm,
        heightCm: v.heightCm,
        borderCm: v.borderCm,
        editionSize: v.editionSize,
        priceEuros: v.priceCents != null ? String(v.priceCents / 100) : '',
        sourceArtworkTitle: v.artwork.title ?? '(untitled)',
      }))

    return NextResponse.json({ templates })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load variant templates' },
      { status: 500 },
    )
  }
}
