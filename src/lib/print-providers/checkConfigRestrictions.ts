/**
 * Provider-agnostic guard: does this WizardConfig respect the artist's
 * per-artwork restrictions? Used by the server-side payment intent
 * handler to reject configs whose option got artist-vetoed between the
 * wizard pickup and the buyer hitting Pay.
 *
 * Iterates the catalog's enum dimensions only — sizes and borders
 * don't carry allow-lists in our restriction shape. For each enum dim
 * with an allow-list set, the buyer's chosen option must be in it.
 */
import type { Catalog, PrintRestrictions, WizardConfig } from './types'
import { dimensionAllowList, isDimensionVisible } from './configHelpers'

export type RestrictionClash = {
  /** The dimension that clashed (catalog dim id). */
  dimensionId: string
  /** Display label for the dimension, for error messaging. */
  dimensionLabel: string
}

/**
 * Returns the first dimension that violates the restriction (so the
 * caller can render a specific error like "the paper you chose isn't
 * available any more"), or null if everything passes.
 */
export function findConfigRestrictionClash(
  catalog: Catalog,
  config: WizardConfig,
  restrictions: PrintRestrictions | null | undefined,
): RestrictionClash | null {
  if (!restrictions?.allowed) return null
  for (const dim of catalog.dimensions) {
    if (dim.kind !== 'enum') continue
    if (!isDimensionVisible(dim, config, catalog)) continue
    const allowed = dimensionAllowList(restrictions, dim.id)
    if (!allowed) continue
    const value = config.values[dim.id]
    if (!value) continue
    if (!allowed.includes(value)) {
      return { dimensionId: dim.id, dimensionLabel: dim.label }
    }
  }
  return null
}
