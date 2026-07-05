import { formatMoneyCents } from '@/lib/money'

/**
 * Money for emails: "€1,234.56" for EUR, otherwise "USD 1,234.56".
 * Thin alias over the shared formatter so emails and the invoice PDF can
 * never render the same amount differently.
 * @param currency ISO 4217 currency code (e.g. 'eur', 'usd').
 */
export function formatAmount(cents: number, currency: string): string {
  return formatMoneyCents(cents, currency)
}
