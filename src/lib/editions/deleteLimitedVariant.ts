/**
 * Delete ONE limited-edition variant, immediately.
 *
 * Deleting used to be a local edit to the dashboard form that only reached
 * the database when the artist saved the whole artwork — so a delete followed
 * by a reload silently came back, and a failure inside the artwork PUT could
 * swallow it entirely. The button now deletes on confirm and calls straight
 * in here, which means every rule `saveLimitedVariants` enforced on its own
 * delete path has to be enforced at the moment of the click instead.
 *
 * The rules, in the order a person would want to hear them:
 *   - a LIVE variant (published + blocked) is never deletable — it is on sale
 *   - a variant holding a reserved or sold number is never deletable, even
 *     once an admin has unblocked it: that number is a real sale, and its
 *     print may already exist
 *   - a limited edition can't be left with zero variants
 *
 * Kept as a standalone module (no Next/auth imports) so the route handler is
 * only responsible for auth and this is directly exercisable from an e2e
 * spec — same split as `saveLimitedVariants` / `parseIncomingVariants`.
 */
import prisma from '@/lib/prisma'

export type DeleteVariantResult = { ok: true } | { ok: false; error: string }

export async function deleteLimitedVariant(args: {
  artworkId: string
  variantId: string
}): Promise<DeleteVariantResult> {
  const { artworkId, variantId } = args

  const variant = await prisma.limitedVariant.findUnique({
    where: { id: variantId },
    select: { id: true, artworkId: true, published: true, blocked: true, name: true },
  })
  // Ownership of the variant BY THE ARTWORK, not just existence — otherwise a
  // guessed id from someone else's artwork would delete through this artwork's
  // permission check.
  if (!variant || variant.artworkId !== artworkId) {
    return { ok: false, error: 'Variant not found.' }
  }

  if (variant.published && variant.blocked) {
    return {
      ok: false,
      error:
        'This variant is on sale and can’t be deleted. Ask an admin to take it off sale first.',
    }
  }

  // Unblocked but already sold from: the copies are out in the world (or held
  // by a live checkout), so the ledger has to keep them.
  const committed = await prisma.editionNumber.count({
    where: { variantId, state: { in: ['reserved', 'sold'] } },
  })
  if (committed > 0) {
    const copies = committed === 1 ? 'print' : 'prints'
    const them = committed === 1 ? 'it' : 'them'
    // Say what to DO about it. A refusal with no way forward reads as a bug,
    // and the way forward is real: cancelling or refunding a pre-production
    // order returns its number to the pool (see `stageAllowsEditionRelease`),
    // after which this variant deletes normally.
    return {
      ok: false,
      error:
        `This variant has ${committed} sold or reserved ${copies}, so it can’t be deleted — ` +
        `deleting it would break the ${committed === 1 ? 'order that owns' : 'orders that own'} ` +
        `${them}. Cancel or refund that order first; while production hasn’t started, ` +
        `the number goes back to the pool and this variant becomes deletable.`,
    }
  }

  const total = await prisma.limitedVariant.count({ where: { artworkId } })
  if (total <= 1) {
    return {
      ok: false,
      error: 'A limited edition needs at least one variant — add another before deleting this one.',
    }
  }

  await prisma.$transaction(async (tx) => {
    // The variant's EditionNumber rows cascade with it (all `available` by the
    // guard above, so nothing sold is being erased).
    await tx.limitedVariant.delete({ where: { id: variantId } })

    // Keep the series-type lock honest, exactly as the unblock route does: the
    // open/limited radio is frozen only while at least one variant is live.
    // Deleting the last live one re-opens it.
    const stillLive = await tx.limitedVariant.count({
      where: { artworkId, published: true, blocked: true },
    })
    await tx.artwork.update({
      where: { id: artworkId },
      data: { editionLocked: stillLive > 0 },
    })
  })

  return { ok: true }
}
