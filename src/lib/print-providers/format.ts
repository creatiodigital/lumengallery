/**
 * Provider-agnostic formatters used across the wizard, summary, and any
 * downstream surface that displays prices or sizes. Live in the
 * print-providers root so callers don't have to know which adapter
 * handled their order.
 */

export function formatEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

// Output follows art-gallery convention: height × width.
// Args still take (wCm, hCm) so callers don't have to swap; the
// function reorders internally for display.
export function formatDualDimensions(wCm: number, hCm: number): string {
  return `${hCm} × ${wCm} cm`
}
