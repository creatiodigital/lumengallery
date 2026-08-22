/**
 * Which limited-edition variant the buyer's wizard has selected.
 *
 * Single-select, and never empty. One edition at a time, because the wall
 * preview, the size schema and the spec list all describe exactly one print —
 * and always one, because the panel beside them has nothing to say without it.
 * Picking another switches; there is no unselecting.
 *
 * A variant already in the cart stays fully selectable. Selecting is how the
 * buyer puts an edition on the wall in the 3D preview, and that is worth doing
 * again after buying — locking the card would take the inspection away as a
 * side effect of the purchase. What a carted variant loses is only the ADD: the
 * cart offers no edit for a limited line and no second copy of one, the variant
 * being the object rather than a configuration of it.
 *
 * Deliberately free of cart and edition types: it takes the minimum shape from
 * each side, so it stays pure and testable without a page, a cart provider or
 * the WebGL preview the wizard mounts.
 */

/** The only two fields a cart line needs for these decisions. */
type CartedLine = { artworkId: string; variantId?: string }

/** The only field a variant needs for these decisions. */
type Selectable = { id: string }

/**
 * Ids of THIS artwork's variants that already sit in the cart.
 *
 * Scoped by artwork on purpose: variant ids are unique, but a cart holding
 * another work's editions must not mark anything here, and scoping makes that
 * impossible rather than merely unlikely.
 */
export function cartedVariantIds(items: CartedLine[], artworkId: string): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.artworkId === artworkId && item.variantId) ids.add(item.variantId)
  }
  return ids
}

/**
 * The selected variant, re-resolved against what is on sale now.
 *
 * The stored id is a wish rather than a fact, so every render re-checks it and
 * falls back to the first edition on sale. That covers both the opening state,
 * where nothing has been clicked yet, and an edition selling out from under a
 * selection that has been sitting there — neither may leave the wizard with no
 * edition selected. Null only when there is nothing on sale at all.
 */
export function resolveSelectedVariant<T extends Selectable>(
  selectedId: string | null,
  available: readonly T[],
): T | null {
  const chosen = selectedId ? available.find((v) => v.id === selectedId) : undefined
  return chosen ?? available[0] ?? null
}
