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
 * format = "print only").
 */
import { formatCm, formatDualDimensions } from './format'
import type { Catalog, Dimension, WizardConfig } from './types'
import {
  getEffectiveBorderCm,
  getEffectiveMatCm,
  getEffectiveSizeCm,
  isDimensionVisible,
} from './configHelpers'

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
  const rows: SpecsSummary = []
  for (const dim of catalog.dimensions) {
    if (!isDimensionVisible(dim, config, catalog)) continue
    const value = renderDimensionValue(dim, config, catalog)
    if (value === null) continue
    rows.push({ id: dim.id, label: dim.label, value })
  }
  return withSheetRow(rows, catalog, config)
}

/**
 * Insert the SHEET — the piece of paper the print is centred on — above the
 * print size.
 *
 * It belongs here, in the shared summary, and not in the wizard's panel where
 * it started: this function's output is snapshotted onto the cart line at
 * add-to-cart and is what the cart, checkout, the confirmation email, the admin
 * order and the invoice all render. A row added downstream of it appears once,
 * on one screen, and then vanishes from every document describing the same
 * purchase.
 *
 * Derived rather than stored, so it holds for both kinds of limited variant and
 * for open editions alike: image + its two real borders. On a fixed-sheet
 * edition that reconstructs exactly the sheet the artist typed, because that
 * sheet is what produced the image. Skipped when there is no border, where the
 * sheet IS the print and the row would only repeat the line below it.
 */
function withSheetRow(rows: SpecsSummary, catalog: Catalog, config: WizardConfig): SpecsSummary {
  const sizeCm = getEffectiveSizeCm(catalog, config)
  if (!sizeCm) return rows
  const borderXCm = getEffectiveBorderCm(config, 'border')
  const borderYCm = config.borders?.['border']?.verticalCm ?? borderXCm
  if (borderXCm <= 0 && borderYCm <= 0) return rows

  // Millimetre rounding: the derivation is float work — 24.2318… + 7.884 × 2
  // lands a hair off 40 and would read "40.0" only by luck.
  const mm = (n: number) => Math.round(n * 10) / 10
  const sheetRow = {
    id: 'sheet',
    label: 'Sheet size',
    value: formatDualSize(mm(sizeCm.widthCm + borderXCm * 2), mm(sizeCm.heightCm + borderYCm * 2)),
  }
  const sizeAt = rows.findIndex((r) => r.id === 'size')
  return sizeAt === -1
    ? [...rows, sheetRow]
    : [...rows.slice(0, sizeAt), sheetRow, ...rows.slice(sizeAt)]
}

function renderDimensionValue(
  dim: Dimension,
  config: WizardConfig,
  catalog: Catalog,
): string | null {
  if (dim.kind === 'enum') {
    const value = config.values[dim.id]
    if (!value) return null
    const label = dim.options.find((o) => o.id === value)?.label ?? null
    // Mount size presets (Small/Large) scale with the print size —
    // append the resolved width so the buyer sees the actual cut,
    // not just the preset name.
    if (label && dim.id === 'windowMountSize') {
      const matCm = getEffectiveMatCm(catalog, config)
      if (matCm > 0) return `${label} (≈ ${formatCm(matCm)} cm)`
    }
    return label
  }
  if (dim.kind === 'size') {
    const sizeCm = getEffectiveSizeCm(catalog, config)
    if (!sizeCm) return null
    // Height first, ALWAYS — the gallery convention, and the same order the
    // variant card and the artist's editor use. This used to swap the two on
    // landscape work, which printed the width first and disagreed with every
    // other surface showing the same print.
    return formatDualSize(sizeCm.widthCm, sizeCm.heightCm)
  }
  if (dim.kind === 'border') {
    // Keep the row even when the border is 0 — buyers want to see
    // "this dimension exists, you chose none" rather than the row
    // vanishing. 0 (or unset) renders as "N/A".
    const cm = getEffectiveBorderCm(config, dim.id)
    const verticalCm = config.borders?.[dim.id]?.verticalCm
    if (cm <= 0 && !verticalCm) return '—'
    // Fixed-sheet editions have unequal borders by design — showing one
    // number would misdescribe the object the buyer receives.
    if (typeof verticalCm === 'number' && Math.abs(verticalCm - cm) >= 0.05) {
      return `${formatCm(verticalCm)} cm top and bottom, ${formatCm(cm)} cm left and right`
    }
    return `${formatCm(cm)} cm`
  }
  return null
}

function formatDualSize(widthCm: number, heightCm: number): string {
  return formatDualDimensions(widthCm, heightCm)
}
