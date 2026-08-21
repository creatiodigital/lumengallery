/**
 * Save ONE variant on its own — the "Save variant" button on a variant card.
 *
 * `saveLimitedVariants` reconciles the WHOLE list and re-validates every
 * variant, so editing one meant scrolling to the bottom of the artwork form and
 * saving everything — and it fails outright if any OTHER variant on the artwork
 * has drifted out of spec (e.g. its image was replaced with a differently
 * proportioned file). Editing one variant shouldn't be hostage to that.
 *
 * Same rules as the full save, scoped to a single row:
 *   - a LIVE variant (published + blocked) accepts only NAME and PRICE. Its
 *     physical identity is what a buyer was promised. Delegates to
 *     `updateVariantNameAndPrice`.
 *   - anything else (draft, or a published variant an admin unblocked) accepts
 *     every field, validated exactly as the full save validates it: aspect
 *     lock, printable range, border rules, margin, and DISTINCT sizes against
 *     its siblings.
 *   - edition size can never drop below an already reserved/sold number, and a
 *     published variant whose size changes has its ledger reconciled.
 *
 * Standalone module (no Next/auth imports) so the route only does auth and this
 * stays directly testable — same split as `deleteLimitedVariant`.
 */
import prisma from '@/lib/prisma'

import { updateVariantNameAndPrice, VARIANT_NAME_MAX_LENGTH } from './updateVariantNameAndPrice'
import { validateVariantInput, MAX_LIMITED_VARIANTS } from './validateVariant'

export type SingleVariantInput = {
  name: string
  paperId: string
  widthCm: number
  heightCm: number
  borderCm: number
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  editionSize: number
  priceCents: number
}

export type SaveSingleVariantResult = { ok: true; variantId: string } | { ok: false; error: string }

export async function saveSingleVariant(args: {
  artworkId: string
  /** Omit to CREATE a new draft variant on this artwork. */
  variantId?: string
  input: SingleVariantInput
  /** Admin/superAdmin. Only they may change the edition type of an artwork
   *  that is already locked for sale — same rule the artwork PUT applies. */
  requesterIsAdmin?: boolean
}): Promise<SaveSingleVariantResult> {
  const { artworkId, variantId, input, requesterIsAdmin = false } = args

  // `variant` is null when we're creating. Everything downstream keys off that.
  const variant = variantId
    ? await prisma.limitedVariant.findUnique({
        where: { id: variantId },
        select: { id: true, artworkId: true, published: true, blocked: true, editionSize: true },
      })
    : null
  // Ownership by the artwork, not mere existence: the route authorises the
  // ARTWORK, so a variant id from someone else's artwork must not pass.
  if (variantId && (!variant || variant.artworkId !== artworkId)) {
    return { ok: false, error: 'Variant not found.' }
  }

  // A live variant is frozen apart from its label and its price — the narrow
  // path already enforces exactly that, margin check included.
  if (variant?.published && variant.blocked) {
    const res = await updateVariantNameAndPrice({
      artworkId,
      variantId: variant.id,
      name: input.name,
      priceCents: input.priceCents,
    })
    return res.ok ? { ok: true, variantId: variant.id } : res
  }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'A variant needs a name.' }
  if (name.length > VARIANT_NAME_MAX_LENGTH) {
    return { ok: false, error: `Keep the name under ${VARIANT_NAME_MAX_LENGTH} characters.` }
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: {
      originalWidth: true,
      originalHeight: true,
      editionType: true,
      editionLocked: true,
    },
  })
  if (!artwork?.originalWidth || !artwork.originalHeight) {
    return { ok: false, error: 'This artwork has no image dimensions yet.' }
  }

  // Adding a variant IS declaring the artwork a limited edition. The dashboard
  // lets the artist pick "Limited Edition" and add a variant without saving the
  // artwork first — and the whole point of a per-variant save is not needing
  // that page save — so the switch has to be able to land from here too, under
  // exactly the lock rule the artwork PUT applies: once an artwork is locked
  // for sale only an admin may change its edition type.
  const needsEditionTypeSwitch = artwork.editionType !== 'limited'
  if (needsEditionTypeSwitch && artwork.editionLocked && !requesterIsAdmin) {
    return {
      ok: false,
      error: 'This artwork is locked for sale. Only an admin can change its edition type.',
    }
  }

  // Sizes must stay distinct across the edition — TPS keys edition identity on
  // the unframed print size — so validate against the SIBLINGS as stored. On a
  // create there is no row to exclude, so every existing variant is a sibling.
  const siblings = await prisma.limitedVariant.findMany({
    where: { artworkId, ...(variantId ? { id: { not: variantId } } : {}) },
    select: { widthCm: true, heightCm: true },
  })
  if (!variantId && siblings.length >= MAX_LIMITED_VARIANTS) {
    return {
      ok: false,
      error: `A limited edition can have at most ${MAX_LIMITED_VARIANTS} variants.`,
    }
  }

  const validated = validateVariantInput({
    variant: input,
    artwork: { widthPx: artwork.originalWidth, heightPx: artwork.originalHeight },
    siblingSizes: siblings.map((s) => ({ widthCm: s.widthCm, heightCm: s.heightCm })),
  })
  if (!validated.ok) return { ok: false, error: validated.error }

  // Already-committed copies are the floor: an unblocked variant can be resized
  // but never shrunk past a number someone already reserved or bought.
  if (variant?.published) {
    const highest = await prisma.editionNumber.findFirst({
      where: { variantId: variant.id, state: { in: ['reserved', 'sold'] } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const floor = highest?.number ?? 0
    if (input.editionSize < floor) {
      return {
        ok: false,
        error: `Edition size can’t be below ${floor} — number ${floor}/${variant.editionSize} is already sold or reserved.`,
      }
    }
  }

  const data = {
    name,
    paperId: input.paperId,
    printTypeId: validated.printTypeId,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    borderCm: input.borderCm,
    sheetWidthCm: input.sheetWidthCm ?? null,
    sheetHeightCm: input.sheetHeightCm ?? null,
    editionSize: input.editionSize,
    priceCents: input.priceCents,
  }

  // CREATE — a brand-new draft. No edition numbers are materialised here; that
  // happens at "Ready to Sell", same as a variant added through the full save.
  // `order` appends it after the existing rows.
  if (!variant) {
    // One transaction with the edition-type switch: an artwork must never end
    // up carrying variants while still typed 'open', nor be flipped to
    // 'limited' by a create that then failed.
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.limitedVariant.create({
        data: { artworkId, ...data, order: siblings.length },
        select: { id: true },
      })
      if (needsEditionTypeSwitch) {
        await tx.artwork.update({ where: { id: artworkId }, data: { editionType: 'limited' } })
      }
      return row
    })
    return { ok: true, variantId: created.id }
  }

  const existing = variant
  await prisma.$transaction(async (tx) => {
    await tx.limitedVariant.update({ where: { id: existing.id }, data })

    // Keep the ledger in step for a PUBLISHED variant whose size moved: grow
    // adds `available` numbers, shrink drops only `available` ones above the
    // new size (committed ones above it were rejected by the floor check).
    if (existing.published && input.editionSize !== existing.editionSize) {
      if (input.editionSize > existing.editionSize) {
        await tx.editionNumber.createMany({
          data: Array.from({ length: input.editionSize - existing.editionSize }, (_, k) => ({
            variantId: existing.id,
            number: existing.editionSize + k + 1,
          })),
          skipDuplicates: true,
        })
      } else {
        await tx.editionNumber.deleteMany({
          where: { variantId: existing.id, number: { gt: input.editionSize }, state: 'available' },
        })
      }
    }
  })

  return { ok: true, variantId: existing.id }
}
