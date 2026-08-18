/**
 * Coerce raw JSON variant rows from a dashboard save into the typed shape
 * `saveLimitedVariants` validates. Numbers come over the wire as strings
 * from the form inputs; everything is re-validated server-side.
 *
 * Kept as a standalone pure module (no Next/Prisma/R2 imports) rather than
 * living inline in the route handler, so it can be exercised directly from
 * an e2e spec without dragging in server-only dependencies.
 */
import type { IncomingVariant } from './saveLimitedVariants'

// Coerce an optional sheet dimension (sheetWidthCm / sheetHeightCm) from the
// wire. Unlike the always-present size fields below, these are legitimately
// absent for an adaptive variant, so a bare `Number(...)` is unsafe:
// `Number(undefined)` is NaN (would fail validation with a confusing
// message) and `Number(null)` is 0 (would read as "set" to a `!= null`
// check while still failing `isFixedSheet`, recreating the half-set state
// this field pair exists to forbid). Only a finite, positive number counts
// as "set" — everything else, including 0/NaN/empty string, means absent.
function coerceOptionalPositiveCm(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function parseIncomingVariants(raw: unknown[]): IncomingVariant[] {
  return raw.map((item) => {
    const v = (item ?? {}) as Record<string, unknown>
    return {
      id: typeof v.id === 'string' && v.id.length > 0 ? v.id : undefined,
      name: typeof v.name === 'string' ? v.name : '',
      paperId: typeof v.paperId === 'string' ? v.paperId : '',
      widthCm: Number(v.widthCm),
      heightCm: Number(v.heightCm),
      borderCm: Number(v.borderCm),
      // Fixed-sheet mode: both present and usable, or both undefined —
      // half-set pairs are caught by isFixedSheet/validateVariantInput.
      sheetWidthCm: coerceOptionalPositiveCm(v.sheetWidthCm),
      sheetHeightCm: coerceOptionalPositiveCm(v.sheetHeightCm),
      editionSize: Number(v.editionSize),
      // Artist types price in euros; persist cents. Round to avoid FP drift.
      priceCents: Math.round(Number(v.priceEuros) * 100) || 0,
    }
  })
}
