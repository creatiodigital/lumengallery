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
 *   - a BLOCKED published variant is frozen: it can't be deleted and none of
 *     its fields can change (its edition numbers are selling)
 *   - an UNBLOCKED published variant (admin reopened it to fix a mistake) is
 *     editable: fields change and the edition-number ledger is reconciled to
 *     the new size — but edition size can never drop below an already
 *     sold/reserved number, and a variant with such numbers can't be deleted
 *   - count between 1 and MAX_LIMITED_VARIANTS
 *
 * Materialising edition numbers + locking the artwork happens separately
 * in the publish action — this only manages the variant rows + ledger.
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
  priceCents: number
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
    return {
      ok: false,
      error: `A limited edition can have at most ${MAX_LIMITED_VARIANTS} variants.`,
    }
  }

  const existing = await prisma.limitedVariant.findMany({
    where: { artworkId },
    select: {
      id: true,
      published: true,
      blocked: true,
      widthCm: true,
      heightCm: true,
      editionSize: true,
    },
  })
  const existingById = new Map(existing.map((v) => [v.id, v]))

  // Highest already-committed (reserved/sold) number per published variant —
  // the hard floor: edition size can't drop below it, and a variant holding
  // any such number can't be deleted. Those are real sales.
  const committedMaxByVariant = new Map<string, number>()
  const publishedIds = existing.filter((e) => e.published).map((e) => e.id)
  if (publishedIds.length > 0) {
    const committed = await prisma.editionNumber.findMany({
      where: { variantId: { in: publishedIds }, state: { in: ['reserved', 'sold'] } },
      select: { variantId: true, number: true },
    })
    for (const c of committed) {
      committedMaxByVariant.set(
        c.variantId,
        Math.max(committedMaxByVariant.get(c.variantId) ?? 0, c.number),
      )
    }
  }

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

    // Lock guard for published variants.
    if (v.id) {
      const prev = existingById.get(v.id)
      if (prev?.published) {
        if (prev.blocked) {
          // Blocked = fully frozen. Nothing about it may change.
          const sizeChanged =
            Math.abs(prev.widthCm - v.widthCm) >= 0.05 ||
            Math.abs(prev.heightCm - v.heightCm) >= 0.05
          if (sizeChanged || prev.editionSize !== v.editionSize) {
            return {
              ok: false,
              error: 'A published variant is locked. Ask an admin to unblock it before editing.',
            }
          }
        } else {
          // Unblocked: edits allowed, but edition size can never drop below
          // an already sold/reserved number.
          const floor = committedMaxByVariant.get(v.id) ?? 0
          if (v.editionSize < floor) {
            return {
              ok: false,
              error: `Edition size can’t be below ${floor} — number ${floor}/${prev.editionSize} is already sold or reserved.`,
            }
          }
        }
      }
    }
    validated.push({ input: v, printTypeId: result.printTypeId })
  }

  const incomingIds = new Set(variants.map((v) => v.id).filter((id): id is string => Boolean(id)))
  const removed = existing.filter((e) => e.published && !incomingIds.has(e.id))
  // A blocked published variant can't be removed at all; an unblocked one can,
  // but only if it has no sold/reserved prints.
  if (removed.some((e) => e.blocked)) {
    return { ok: false, error: 'A published variant cannot be removed while it is blocked.' }
  }
  if (removed.some((e) => (committedMaxByVariant.get(e.id) ?? 0) > 0)) {
    return { ok: false, error: 'A variant with sold or reserved prints cannot be removed.' }
  }

  await prisma.$transaction(async (tx) => {
    // Delete removed variants the guards above allowed: drafts, plus
    // unblocked published variants with no committed numbers (their edition
    // rows are all `available` and cascade-delete with the variant).
    const toDelete = existing
      .filter((e) => !incomingIds.has(e.id) && (!e.published || !e.blocked))
      .map((e) => e.id)
    if (toDelete.length > 0) {
      await tx.limitedVariant.deleteMany({ where: { id: { in: toDelete } } })
    }

    for (let i = 0; i < validated.length; i++) {
      const { input, printTypeId } = validated[i]
      const prev = input.id ? existingById.get(input.id) : undefined

      // Blocked published variants are frozen — skip writes entirely.
      if (prev?.published && prev.blocked) continue

      const data = {
        name: input.name.trim(),
        paperId: input.paperId,
        printTypeId,
        widthCm: input.widthCm,
        heightCm: input.heightCm,
        borderCm: input.borderCm,
        editionSize: input.editionSize,
        priceCents: input.priceCents,
        order: i,
      }

      if (prev) {
        await tx.limitedVariant.update({ where: { id: prev.id }, data })

        // Reconcile the ledger when an unblocked published variant's edition
        // size changed. Grow → add `available` numbers; shrink → drop only
        // `available` numbers above the new size (committed ones above it were
        // already rejected by the floor check, so none remain to protect).
        if (prev.published && input.editionSize !== prev.editionSize) {
          if (input.editionSize > prev.editionSize) {
            await tx.editionNumber.createMany({
              data: Array.from({ length: input.editionSize - prev.editionSize }, (_, k) => ({
                variantId: prev.id,
                number: prev.editionSize + k + 1,
              })),
              skipDuplicates: true,
            })
          } else {
            await tx.editionNumber.deleteMany({
              where: { variantId: prev.id, number: { gt: input.editionSize }, state: 'available' },
            })
          }
        }
      } else {
        await tx.limitedVariant.create({ data: { artworkId, ...data } })
      }
    }
  })

  return { ok: true }
}
