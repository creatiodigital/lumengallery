/**
 * THE money display formatter. Every display surface (invoice PDF, emails,
 * wizard, admin tables) formats cents through here — with separate
 * implementations the same order rendered "€1,234.50" on the invoice and
 * "€1234.50" in the email. Thousands-grouped; Unicode minus for negatives
 * (credit notes).
 *
 * The CSV register deliberately does NOT use this — spreadsheets want raw
 * "1234.50" numerics (see invoiceCsv.centsToEur).
 */
export function formatMoneyCents(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : `${currency.toUpperCase()} `
  const abs = Math.abs(cents)
  const grouped = (abs / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return cents < 0 ? `−${symbol}${grouped}` : `${symbol}${grouped}`
}
