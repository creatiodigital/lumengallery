/**
 * Client-safe delivery-estimate dispatcher. Given a canonical
 * `Catalog` plus the buyer's current config + country, returns the
 * end-to-end calendar-day window the wizard surfaces in the summary
 * panel.
 *
 * Imports only from each adapter's client-safe `delivery.ts` module,
 * never from server-only quote/loadCatalog.
 */
import type { Catalog, DeliveryEstimate, WizardConfig } from './types'
import { estimateTpsDelivery } from './printspace/delivery'

export function estimateDelivery(
  catalog: Catalog,
  config: WizardConfig,
  country: string,
): DeliveryEstimate {
  if (!country) return { minDays: 0, maxDays: 0 }
  switch (catalog.providerId) {
    case 'printspace':
      return estimateTpsDelivery(config, country)
    default:
      return { minDays: 0, maxDays: 0 }
  }
}

/** Format the estimate as a short human-readable string. */
export function formatDeliveryEstimate(estimate: DeliveryEstimate): string {
  const { minDays, maxDays } = estimate
  if (minDays === 0 && maxDays === 0) return ''
  if (minDays === maxDays) return `${minDays} days`
  // Compress to "X-Y days" for short ranges, "~N weeks" for longer ones.
  if (maxDays > 21) {
    const weeks = Math.round(maxDays / 7)
    return `up to ~${weeks} weeks`
  }
  return `${minDays}–${maxDays} days`
}
