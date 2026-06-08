/**
 * Reconcile an artwork's limited-edition variants from a dashboard save.
 *
 * The artist edits a flexible list (1 mandatory + up to MAX_LIMITED_VARIANTS,
 * "Add variant" to grow it). This helper diffs that incoming list against
 * what's stored and applies create/update/delete in one transaction.
 *
 * Rules enforced here (the dashboard mirrors them for UX, but this is the
 * authoritative gate):
 *   - every variant validated via `validateVariantInput` (aspect lock,
 *     distinct sizes, border min, derived print type)
 *   - a PUBLISHED variant is frozen: it can't be deleted and its locked
 *     fields can't change (its edition numbers may already be selling)
 *   - count between 1 and MAX_LIMITED_VARIANTS
 *
 * Materialising edition numbers + locking the artwork happens separately
 * in the publish action — this only manages the draft variant rows.
 */
import prisma from '@/lib/prisma'
import { validateVariantInput, MAX_LIMITED_VARIANTS } from './validateVariant'

export type IncomingVariant = {
  id?: string
  name: string
  paperId: string
  widthCm: number
  heightCm: number
  borderCm: number
  editionSize: number
}

export type SaveVariantsResult = { ok: true } | { ok: false; error: string }

export async function saveLimitedVariants(args: {
  artworkId: string
  artworkPixels: { widthPx: number; heightPx: number }
  variants: IncomingVariant[]
}): Promise<SaveVariantsResult> {
  const { artworkId, artworkPixels, variants } = args

  if (variants.length < 1) {
    return { ok: false, error: 'A limited edition needs at least one variant.' }
  }
  if (variants.length > MAX_LIMITED_VARIANTS) {
    return { ok: false, error: `A limited edition can have at most ${MAX_LIMITED_VARIANTS} variants.` }
  }

  const existing = await prisma.limitedVariant.findMany({
    where: { artworkId },
    select: { id: true, published: true, widthCm: true, heightCm: true, editionSize: true },
  })
  const existingById = new Map(existing.map((v) => [v.id, v]))

  // Validate every incoming variant. siblingSizes = all the OTHER
  // incoming sizes so the distinctness rule is checked against the final
  // set, not the stored one.
  const validated: { input: IncomingVariant; printTypeId: string }[] = []
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    const siblingSizes = variants
      .filter((_, j) => j !== i)
      .map((s) => ({ widthCm: s.widthCm, heightCm: s.heightCm }))
    const result = validateVariantInput({ variant: v, artwork: artworkPixels, siblingSizes })
    if (!result.ok) return { ok: false, error: result.error }

    // Frozen-field guard for published variants.
    if (v.id) {
      const prev = existingById.get(v.id)
      if (prev?.published) {
        const sizeChanged =
          Math.abs(prev.widthCm - v.widthCm) >= 0.05 || Math.abs(prev.heightCm - v.heightCm) >= 0.05
        if (sizeChanged || prev.editionSize !== v.editionSize) {
          return {
            ok: false,
            error: 'A published variant’s size and edition size are locked and cannot change.',
          }
        }
      }
    }
    validated.push({ input: v, printTypeId: result.printTypeId })
  }

  const incomingIds = new Set(variants.map((v) => v.id).filter((id): id is string => Boolean(id)))
  // Deleting a published variant is not allowed.
  const removingPublished = existing.some((e) => e.published && !incomingIds.has(e.id))
  if (removingPublished) {
    return { ok: false, error: 'A published variant cannot be removed.' }
  }

  await prisma.$transaction(async (tx) => {
    // Delete unpublished variants the artist removed.
    const toDelete = existing
      .filter((e) => !e.published && !incomingIds.has(e.id))
      .map((e) => e.id)
    if (toDelete.length > 0) {
      await tx.limitedVariant.deleteMany({ where: { id: { in: toDelete } } })
    }

    for (let i = 0; i < validated.length; i++) {
      const { input, printTypeId } = validated[i]
      const prev = input.id ? existingById.get(input.id) : undefined

      // Published variants are frozen — skip writes entirely.
      if (prev?.published) continue

      const data = {
        name: input.name.trim(),
        paperId: input.paperId,
        printTypeId,
        widthCm: input.widthCm,
        heightCm: input.heightCm,
        borderCm: input.borderCm,
        editionSize: input.editionSize,
        order: i,
      }

      if (prev) {
        await tx.limitedVariant.update({ where: { id: prev.id }, data })
      } else {
        await tx.limitedVariant.create({ data: { artworkId, ...data } })
      }
    }
  })

  return { ok: true }
}
