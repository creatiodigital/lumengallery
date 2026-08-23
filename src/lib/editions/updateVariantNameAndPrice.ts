/**
 * Save ONE variant's name and price on their own, without saving the artwork.
 *
 * Why this exists separately from `saveLimitedVariants`: that helper reconciles
 * the WHOLE list and re-validates every variant's geometry, so changing one
 * variant's price meant scrolling to the bottom of the artwork form and saving
 * everything — and it fails outright if any OTHER variant on the artwork has
 * drifted out of spec (e.g. its image was replaced with a differently
 * proportioned file). A price change should not be hostage to that.
 *
 * Name and price are the two fields that stay editable for a variant's whole
 * life, including while it is on sale — see `saveLimitedVariants` for why the
 * name is safe (it is a label; no invoice references it). Everything physical
 * — size, sheet, paper, border, edition size — is deliberately NOT accepted
 * here: those go through the full artwork save, where the geometry rules and
 * the on-sale freeze apply.
 *
 * The one real constraint is the price: a variant must still earn more than
 * the paper around its print costs to produce, so the margin is re-checked
 * against the variant's STORED geometry.
 *
 * Standalone module (no Next/auth imports) so the route handler only does auth
 * and this stays directly testable — same split as `deleteLimitedVariant`.
 */
import prisma from '@/lib/prisma'

import { estimateVariantMarginCents } from './variantMargin'

export const VARIANT_NAME_MAX_LENGTH = 60

export type UpdateVariantResult =
  | { ok: true; name: string; priceCents: number }
  | { ok: false; error: string }

export async function updateVariantNameAndPrice(args: {
  artworkId: string
  variantId: string
  name: string
  priceCents: number
}): Promise<UpdateVariantResult> {
  const { artworkId, variantId } = args
  const name = args.name.trim()
  const priceCents = args.priceCents

  const variant = await prisma.limitedVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      artworkId: true,
      widthCm: true,
      heightCm: true,
      borderCm: true,
      sheetWidthCm: true,
      sheetHeightCm: true,
    },
  })
  // Ownership by the artwork, not mere existence — the route authorises the
  // ARTWORK, so a variant id from someone else's artwork must not pass.
  if (!variant || variant.artworkId !== artworkId) {
    return { ok: false, error: 'Variant not found.' }
  }

  if (!name) {
    return { ok: false, error: 'A variant needs a name.' }
  }
  if (name.length > VARIANT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Keep the name under ${VARIANT_NAME_MAX_LENGTH} characters.`,
    }
  }

  if (!Number.isFinite(priceCents) || !Number.isInteger(priceCents) || priceCents <= 0) {
    return { ok: false, error: 'Enter a price greater than zero.' }
  }

  // Margin check against the STORED geometry: on a fixed sheet the gallery
  // absorbs the cost of the paper around the print, and a price too low to
  // cover it would sell at a loss. Mirrors the rule in validateVariantInput,
  // applied to the only field we let through that can break it.
  const margin = estimateVariantMarginCents({
    widthCm: variant.widthCm,
    heightCm: variant.heightCm,
    borderCm: variant.borderCm,
    sheetWidthCm: variant.sheetWidthCm,
    sheetHeightCm: variant.sheetHeightCm,
    artistPriceCents: priceCents,
  })
  if (margin && margin.marginCents <= 0) {
    const euros = (c: number) => (c / 100).toFixed(2)
    return {
      ok: false,
      error:
        `At €${euros(priceCents)} this variant doesn’t cover its own production: the paper ` +
        `around the print costs €${euros(margin.absorbedCents)} more than the print alone, ` +
        `which is more than the gallery earns on it. Raise the price.`,
    }
  }

  await prisma.limitedVariant.update({
    where: { id: variantId },
    data: { name, priceCents },
  })

  return { ok: true, name, priceCents }
}
