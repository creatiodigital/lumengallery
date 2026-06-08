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
  /** True once published (size/editionSize then frozen). */
  published?: boolean
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
  /** Count of edition numbers still available to buy. 0 = sold out. */
  remaining: number
}
