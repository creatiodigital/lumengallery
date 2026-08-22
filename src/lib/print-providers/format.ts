/**
 * Provider-agnostic formatters used across the wizard, summary, and any
 * downstream surface that displays prices or sizes. Live in the
 * print-providers root so callers don't have to know which adapter
 * handled their order.
 */

import { formatMoneyCents } from '@/lib/money'

export function formatEuro(cents: number): string {
  return formatMoneyCents(cents, 'eur')
}

// Output follows art-gallery convention: height × width.
// Args still take (wCm, hCm) so callers don't have to swap; the
// function reorders internally for display.
export function formatDualDimensions(wCm: number, hCm: number): string {
  return `${formatCm(hCm)} × ${formatCm(wCm)} cm`
}

// A fixed-sheet edition's print size is DERIVED from the sheet and stored at
// full precision on purpose (validation requires it to be exactly what the
// sheet derives), so it arrives here as 24.2318698789287 and printed that way
// on the variant card. Round to the 0.1 cm every size input steps by, and drop
// a trailing .0 so a whole number stays "40" rather than "40.0". Mirrors
// `roundCm` in ./specs.ts.
/**
 * THE way a centimetre length is written, everywhere it is shown.
 *
 * ALWAYS one decimal — 40.0, 50.0, 24.2, 7.9 — which is the gallery
 * convention: a catalogue entry records every measurement to the same
 * precision, so nothing in it looks more carefully measured than anything
 * else. It also makes consistency structural rather than something each
 * caller has to coordinate: a sheet formatted in the picker and a print size
 * formatted by the spec list agree without ever knowing about each other.
 *
 * Dropping trailing zeros was the earlier rule and it could not hold. It made
 * precision depend on the VALUE, so one screen showed "40 × 50 cm sheet"
 * beside "24.2 × 36.0 cm print" — two measurements of one object, written two
 * different ways.
 */
export function formatCm(v: number): string {
  return v.toFixed(1)
}
