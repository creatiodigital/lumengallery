/**
 * Money for emails: "€12.34" for EUR, otherwise "USD 12.34".
 * @param currency ISO 4217 currency code (e.g. 'eur', 'usd').
 */
export function formatAmount(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' '
  return `${symbol}${(cents / 100).toFixed(2)}`
}
