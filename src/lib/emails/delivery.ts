// EU member states (2026) — destinations where flat 21% VAT applies
// at checkout via OSS, so no import duty greets the buyer.
export const EU_ISO_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
])

/**
 * Rough end-to-end delivery window by destination (production + shipping
 * on Standard tier). Indicative, not guaranteed —
 * framed orders can push the upper bound.
 */
export function estimateDeliveryWindow(countryCode: string): { minDays: number; maxDays: number } {
  const cc = countryCode.toUpperCase()
  if (cc === 'GB') return { minDays: 3, maxDays: 7 }
  if (EU_ISO_CODES.has(cc)) return { minDays: 6, maxDays: 10 }
  if (cc === 'US' || cc === 'CA') return { minDays: 7, maxDays: 14 }
  if (cc === 'AU' || cc === 'NZ') return { minDays: 10, maxDays: 20 }
  return { minDays: 10, maxDays: 21 }
}

/**
 * True when the destination is likely to hit cross-border customs on
 * delivery. Ships from the UK; UK domestic and IOSS-covered
 * EU orders stay clean. Anywhere else, the shipment crosses a border
 * and the buyer may owe local tax/duty. We disclose it upfront so
 * there's no surprise at the door.
 */
export function mayOweImportDuty(countryCode: string): boolean {
  const cc = countryCode.toUpperCase()
  if (cc === 'GB') return false
  if (cc === 'US') return false
  if (EU_ISO_CODES.has(cc)) return false
  return true
}
