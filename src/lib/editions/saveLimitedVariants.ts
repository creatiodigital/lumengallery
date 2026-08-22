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
 *   - a BLOCKED published variant is frozen: it can't be deleted, and only its
 *     NAME and PRICE can change (its edition numbers are selling, so size,
 *     sheet, paper, border and edition size are what a buyer was promised)
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
import { TPS_PAPERS } from '@/lib/print-providers/printspace'
import { validateVariantInput, MAX_LIMITED_VARIANTS } from './validateVariant'

export type IncomingVariant = {
  id?: string
  name: string
  paperId: string
  widthCm: number
  heightCm: number
  borderCm: number
  /** Fixed-sheet mode: total sheet in cm. Both null/absent = adaptive. */
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
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
      name: true,
      paperId: true,
      widthCm: true,
      heightCm: true,
      borderCm: true,
      sheetWidthCm: true,
      sheetHeightCm: true,
      editionSize: true,
      priceCents: true,
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

  // Distinct names within the artwork. The name is how a variant is identified
  // everywhere it matters — the picker, the cart line, the invoice, the ledger,
  // the admin's paste-into-TPS block — so two "40x50 Baryta" on one work makes
  // every one of those ambiguous. Trimmed and case-insensitive, because "Small"
  // and "small " are the same name to everyone except a database.
  const byName = new Map<string, number>()
  for (const v of variants) {
    const key = (v.name ?? '').trim().toLowerCase()
    if (key.length === 0) continue
    byName.set(key, (byName.get(key) ?? 0) + 1)
  }
  const duplicate = [...byName.entries()].find(([, n]) => n > 1)
  if (duplicate) {
    const shown = variants.find((v) => (v.name ?? '').trim().toLowerCase() === duplicate[0])?.name
    return {
      ok: false,
      error: `Two variants are both called “${shown?.trim()}”. Give each one its own name.`,
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
    // Only judge what this save actually proposes. An untouched variant is
    // already live and already sold from; re-testing it against today's rules
    // means a row created before a rule existed blocks every unrelated edit to
    // the artwork — and if it holds sold copies it cannot be deleted either, so
    // the artist is simply stuck. Grandfathered, not endorsed: change any
    // measurement on it and it must pass in full like anything else.
    const prior = v.id ? existingById.get(v.id) : undefined
    const unchanged =
      prior !== undefined &&
      prior.paperId === v.paperId &&
      prior.widthCm === v.widthCm &&
      prior.heightCm === v.heightCm &&
      prior.borderCm === v.borderCm &&
      (prior.sheetWidthCm ?? null) === (v.sheetWidthCm ?? null) &&
      (prior.sheetHeightCm ?? null) === (v.sheetHeightCm ?? null)

    // The paper is unchanged too (it is one of the compared fields), so its
    // print type is whatever it already was — but fall back to the full check
    // if the paper id has somehow stopped resolving.
    const grandfatheredPrintType = unchanged
      ? TPS_PAPERS.find((pp) => pp.id === v.paperId)?.printType
      : undefined
    const result = grandfatheredPrintType
      ? ({ ok: true, printTypeId: grandfatheredPrintType } as const)
      : validateVariantInput({ variant: v, artwork: artworkPixels, siblingSizes })
    // Name the variant: every variant is checked on every save, so an
    // unattributed message sends the artist looking at whichever one they just
    // touched rather than the one that actually broke a rule.
    if (!result.ok) {
      const label = v.name?.trim()
      return { ok: false, error: label ? `“${label}”: ${result.error}` : result.error }
    }

    // Lock guard for published variants.
    if (v.id) {
      const prev = existingById.get(v.id)
      if (prev?.published) {
        if (prev.blocked) {
          // Blocked = on sale. The variant's PHYSICAL identity is frozen — size,
          // sheet, paper, border, edition size are what a buyer is promised and
          // what the lab prints. Two things stay editable:
          //   - price, raised as the edition sells (price escalation)
          //   - NAME, which is only a label. Nothing financial or physical hangs
          //     off it: invoices never reference it, buyer emails bake it in at
          //     order-creation time, and every other surface (ledger, gift
          //     orders, variant picker, admin rows) joins it live, so a rename
          //     propagates everywhere and rewrites no history.
          // Reject any change outside those two.
          const sizeChanged =
            Math.abs(prev.widthCm - v.widthCm) >= 0.05 ||
            Math.abs(prev.heightCm - v.heightCm) >= 0.05
          // The sheet is part of the variant's physical identity — a live
          // edition's paper size can never change under a buyer.
          const sheetChanged =
            Math.abs((prev.sheetWidthCm ?? 0) - (v.sheetWidthCm ?? 0)) >= 0.005 ||
            Math.abs((prev.sheetHeightCm ?? 0) - (v.sheetHeightCm ?? 0)) >= 0.005
          const frozenFieldChanged =
            sizeChanged ||
            sheetChanged ||
            prev.editionSize !== v.editionSize ||
            prev.paperId !== v.paperId ||
            Math.abs(prev.borderCm - v.borderCm) >= 0.005
          if (frozenFieldChanged) {
            return {
              ok: false,
              error:
                'A published variant is locked while on sale — only its name and price can change. Ask an admin to unblock it to edit anything else.',
            }
          }
          if (!v.name.trim()) {
            return { ok: false, error: 'A variant needs a name.' }
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

      // Blocked published variants are frozen EXCEPT for name + price — persist
      // just those and skip every other field. The guard above has already
      // rejected any change to a frozen one.
      if (prev?.published && prev.blocked) {
        const nextName = input.name.trim()
        if (prev.priceCents !== input.priceCents || prev.name !== nextName) {
          await tx.limitedVariant.update({
            where: { id: prev.id },
            data: { priceCents: input.priceCents, name: nextName },
          })
        }
        continue
      }

      const data = {
        name: input.name.trim(),
        paperId: input.paperId,
        printTypeId,
        widthCm: input.widthCm,
        heightCm: input.heightCm,
        borderCm: input.borderCm,
        sheetWidthCm: input.sheetWidthCm ?? null,
        sheetHeightCm: input.sheetHeightCm ?? null,
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
