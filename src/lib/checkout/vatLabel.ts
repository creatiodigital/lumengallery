/**
 * Buyer-facing label for the VAT row.
 *
 * The rate is the one thing a tax line has to state. "VAT €113.51" leaves the
 * buyer to divide it out to check the order is being taxed correctly, and on an
 * export sale a bare "VAT €0.00" reads like an omission rather than the
 * deliberate zero-rating it is.
 *
 * Takes the authoritative rate rather than deriving one from the amounts:
 * dividing two already-rounded figures lands on 20% or 22% at the edges, and
 * the number shown to a buyer on an invoice-bearing order should be the rate
 * actually applied.
 */
export function vatLabel(rate: number): string {
  // Whole percents cover every rate we charge (21% home, 0% export). A
  // fractional rate would still render honestly rather than silently rounding.
  const percent = Number.isInteger(rate * 100) ? rate * 100 : Math.round(rate * 1000) / 10
  return `VAT (${percent}%)`
}
