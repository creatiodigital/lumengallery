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

    // Without the image's dimensions we can't derive a print size for ANY
    // template, fixed-sheet included. Say so: reporting this as "no matching
    // proportions" blames the aspect ratio for an artwork that has no image.
    if (!artwork.originalWidth || !artwork.originalHeight) {
      return NextResponse.json({ templates: [], reason: 'no-dimensions' })
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
        sheetWidthCm: true,
        sheetHeightCm: true,
        editionSize: true,
        priceCents: true,
        artwork: { select: { title: true, originalWidth: true, originalHeight: true } },
      },
    })

    // EVERY variant this artist has authored, one entry per distinct NAME
    // (Eduardo, 2026-08-22). This replaces an exact-ratio filter that only ever
    // offered fixed-sheet templates in practice: an adaptive template made on a
    // portrait work was silently withheld from a landscape one, so an artist
    // with three saved variants saw one and no reason why.
    //
    // Offering all of them is safe because the shape rules moved to where they
    // belong — save-time validation now rejects a mismatched orientation or
    // ratio by name, loudly, instead of the picker quietly deciding for the
    // artist. Applying a template that does not fit is answered with a sentence
    // rather than an absence.
    //
    // `orderBy: updatedAt desc` above means the FIRST occurrence of a name is
    // its most recently touched version, which is the one to offer.
    const seen = new Set<string>()
    const templates = variants
      .filter((v) => {
        const key = (v.name ?? '').trim().toLowerCase()
        if (key.length === 0 || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((v) => ({
        name: v.name,
        paperId: v.paperId,
        widthCm: v.widthCm,
        heightCm: v.heightCm,
        borderCm: v.borderCm,
        sheetWidthCm: v.sheetWidthCm,
        sheetHeightCm: v.sheetHeightCm,
        editionSize: v.editionSize,
        priceEuros: v.priceCents != null ? String(v.priceCents / 100) : '',
        sourceArtworkTitle: v.artwork.title ?? '(untitled)',
      }))

    // Distinguish "you have nothing saved yet" from "you have saved variants,
    // but none share this artwork's exact proportions" — very different things
    // to tell an artist staring at an empty picker.
    const reason =
      templates.length > 0 ? null : variants.length === 0 ? 'none-saved' : 'no-ratio-match'

    return NextResponse.json({ templates, reason })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load variant templates' },
      { status: 500 },
    )
  }
}
