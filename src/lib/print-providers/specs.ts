/**
 * Provider-agnostic display rows for a buyer's wizard configuration.
 *
 * The summary panels (wizard right-hand side, checkout right-hand side)
 * and the order admin view all need to show the buyer "here is exactly
 * what you selected". Each provider emits a different set of dimensions
 * (TPS: print type / paper / size / framing / etc.).
 * paper / format / frame type / moulding / glass / hanging /
 * passepartout / size / border) — we don't try to flatten that into a
 * fixed shape. We just render whatever the catalog declared, in
 * declaration order, using each dimension's own buyer-facing label.
 *
 * The buyer never sees a row for a dimension they didn't pick or one
 * that isn't currently visible (e.g. frame moulding hides itself when
 * format = "print only"), and never sees orientation as its own row
 * since the size string already flips for landscape.
 */
import type { Catalog, Dimension, WizardConfig } from './types'
import { getEffectiveBorderCm, getEffectiveSizeCm, isDimensionVisible } from './configHelpers'

export type SpecRow = {
  /** Stable key for React + persistence — the catalog dimension id. */
  id: string
  /** Buyer-facing label, taken from the dimension's own `label`. */
  label: string
  /** Buyer-facing value — option label, formatted size, border width, etc. */
  value: string
}

/**
 * Full ordered list of (label, value) pairs for what the buyer has
 * configured. Always render every row in this list — what's in here is
 * exactly what they should see. Empty array = nothing configured yet.
 */
export type SpecsSummary = SpecRow[]

/**
 * Build the summary rows from a catalog + buyer config. Pure data —
 * provider-agnostic. Iterates `catalog.dimensions` in order so the
 * displayed sequence matches the wizard step order.
 */
export function summarizeConfig(catalog: Catalog, config: WizardConfig): SpecsSummary {
  const isLandscape = config.values.orientation === 'landscape'
  const rows: SpecsSummary = []
  for (const dim of catalog.dimensions) {
    if (!isDimensionVisible(dim, config, catalog)) continue
    const value = renderDimensionValue(dim, config, catalog, isLandscape)
    if (value === null) continue
    rows.push({ id: dim.id, label: dim.label, value })
  }
  return rows
}

function renderDimensionValue(
  dim: Dimension,
  config: WizardConfig,
  catalog: Catalog,
  isLandscape: boolean,
): string | null {
  if (dim.kind === 'enum') {
    const value = config.values[dim.id]
    if (!value) return null
    return dim.options.find((o) => o.id === value)?.label ?? null
  }
  if (dim.kind === 'size') {
    const sizeCm = getEffectiveSizeCm(catalog, config)
    if (!sizeCm) return null
    const wCm = isLandscape ? sizeCm.heightCm : sizeCm.widthCm
    const hCm = isLandscape ? sizeCm.widthCm : sizeCm.heightCm
    return formatDualSize(wCm, hCm)
  }
  if (dim.kind === 'border') {
    // Keep the row even when the border is 0 — buyers want to see
    // "this dimension exists, you chose none" rather than the row
    // vanishing. 0 (or unset) renders as "N/A".
    const cm = getEffectiveBorderCm(config, dim.id)
    if (cm <= 0) return '—'
    return `${roundCm(cm)} cm`
  }
  // Orientation — already encoded in the size row's swap, would just
  // duplicate information for the buyer.
  return null
}

function formatDualSize(widthCm: number, heightCm: number): string {
  return `${roundCm(heightCm)} × ${roundCm(widthCm)} cm`
}

function roundCm(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
