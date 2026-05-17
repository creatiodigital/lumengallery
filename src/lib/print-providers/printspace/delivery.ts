import type { DeliveryEstimate, WizardConfig } from '../types'
import {
  GALLERY_ADMIN_DAYS,
  TPS_PRODUCTION_DAYS,
  TPS_SHIPPING_DAYS,
  resolveTpsRegion,
  workingToCalendar,
} from './pricing'

/**
 * End-to-end delivery estimate for a TPS-routed order. Calendar-day
 * range covering: gallery admin processing + TPS production +
 * shipping window. Depends on chosen format (framing takes
 * significantly longer than print-only) and destination region.
 *
 * Pure function — safe to call from client components.
 */
export function estimateTpsDelivery(config: WizardConfig, country: string): DeliveryEstimate {
  const region = resolveTpsRegion(country)
  const isFramed = config.values.format === 'framing'
  const productionDays = isFramed ? TPS_PRODUCTION_DAYS.framing : TPS_PRODUCTION_DAYS.printOnly
  const shipping = TPS_SHIPPING_DAYS[region]
  const minWorking = GALLERY_ADMIN_DAYS + productionDays + shipping.min
  const maxWorking = GALLERY_ADMIN_DAYS + productionDays + shipping.max
  return {
    minDays: workingToCalendar(minWorking),
    maxDays: workingToCalendar(maxWorking),
  }
}
