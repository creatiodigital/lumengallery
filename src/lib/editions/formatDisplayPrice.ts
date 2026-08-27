import { formatEuro } from '@/lib/print-providers'

/**
 * Whole euros on a buyer-facing surface — a gallery quotes 450, not 449.67.
 *
 * Production costs are ceilinged to the euro and the gallery cut is 40% of an
 * artist price we set in fives, so this figure arrives already whole and the
 * bare number is the exact one the buyer pays.
 *
 * When it doesn't — an artist price like €233 makes the 40% cut €93.20 — we
 * print the cents rather than hide them. `Math.round` used to round DOWN here,
 * so a €443.20 print advertised as €443 and charged €443.20: advertising below
 * the checkout price, which is the one direction that draws complaints. Showing
 * the true figure keeps the listing honest and makes the mispriced artwork
 * visible instead of silently absorbing it.
 *
 * Lives here rather than in a component because the artwork page's availability
 * card and any future surface must quote a price the same way.
 */
export const formatDisplayPrice = (cents: number) =>
  cents % 100 === 0 ? `€${(cents / 100).toLocaleString('es-ES')}` : formatEuro(cents)
