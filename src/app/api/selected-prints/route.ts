import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import { isArtworkPurchasable, LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import { getGallerySelectionForAdmin } from '@/lib/queries/getGallerySelection'
import prisma from '@/lib/prisma'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error
  return NextResponse.json(await getGallerySelectionForAdmin())
}

/**
 * Batch add. Validated server-side even though the picker only offers sellable
 * work: the modal can sit open while an edition sells out. A batch containing
 * anything unsellable, unknown or already selected is refused WHOLE — a
 * silently partial add leaves a selection the curator did not choose.
 */
export async function POST(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = (await request.json()) as { artworkIds?: unknown }
  const ids = Array.isArray(body.artworkIds)
    ? body.artworkIds.filter((i) => typeof i === 'string')
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'artworkIds must be a non-empty array' }, { status: 400 })
  }

  const artworks = await prisma.artwork.findMany({
    where: { id: { in: ids as string[] } },
    select: {
      id: true,
      printEnabled: true,
      editionType: true,
      printPriceCents: true,
      limitedVariants: { where: LIVE_VARIANT_WHERE, select: { id: true } },
      selectedPrint: { select: { id: true } },
    },
  })

  if (artworks.length !== ids.length) {
    return NextResponse.json({ error: 'One or more artworks do not exist' }, { status: 400 })
  }

  const unusable = artworks.filter(
    (a) =>
      a.selectedPrint !== null ||
      !isArtworkPurchasable({
        printEnabled: a.printEnabled,
        editionType: a.editionType,
        printPriceCents: a.printPriceCents,
        liveVariantCount: a.limitedVariants.length,
      }),
  )
  if (unusable.length > 0) {
    return NextResponse.json(
      { error: 'One or more artworks are not currently selling, or are already selected' },
      { status: 400 },
    )
  }

  // PREPEND, preserving the order given. A work is added in order to be seen, so
  // appending would make every add a two-step action: add, then drag to the top.
  // Push everything already there down by exactly the number arriving, then slot
  // the new ones into 0..n-1 — one transaction, so no read sees a gap or a
  // collision. The curator drags from there.
  await prisma.$transaction([
    prisma.selectedPrint.updateMany({ data: { order: { increment: ids.length } } }),
    prisma.selectedPrint.createMany({
      data: (ids as string[]).map((artworkId, i) => ({ artworkId, order: i })),
    }),
  ])

  revalidatePath('/prints')
  return NextResponse.json({ added: ids.length }, { status: 201 })
}
