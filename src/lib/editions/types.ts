/**
 * Shared client-facing shapes for limited editions, used by the dashboard
 * variant editor and the buyer wizard. The server-authoritative types live
 * with their validators (`validateVariant.ts`, Prisma models).
 */

/** A variant as edited in the dashboard. `id` is absent for a not-yet-saved
 *  row; numbers are kept as-is (the form coerces strings before sending). */
export type LimitedVariantDraft = {
  id?: string
  name: string
  paperId: string
  widthCm: number
  heightCm: number
  borderCm: number
  editionSize: number
  /** Artist's cut for this variant, as the artist types it in euros. The
   *  server converts to cents. Derived from `priceCents` on load. */
  priceEuros?: string
  /** Stored cents from the DB on load (read-only here; the editor edits
   *  `priceEuros`, which is the source of truth on save). */
  priceCents?: number | null
  /** True once published (edition numbers materialised). */
  published?: boolean
  /** Per-variant lock. Only meaningful when published: true = frozen + on
   *  sale; false = an admin unblocked it (editable + paused from sale). */
  blocked?: boolean
}

/** A published variant as shown to the buyer, with live stock. */
export type LimitedVariantView = {
  id: string
  name: string
  paperId: string
  printTypeId: string
  widthCm: number
  heightCm: number
  borderCm: number
  editionSize: number
  /** Artist's cut for this variant, in cents. */
  priceCents: number | null
  /** Count of edition numbers still available to buy. 0 = sold out. */
  remaining: number
}
