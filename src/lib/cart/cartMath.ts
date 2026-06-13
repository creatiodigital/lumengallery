import type { WizardConfig } from '@/lib/print-providers'
import type { CartItem, CartItemTotals } from './types'

type MoneyParts = Pick<CartItem, 'unitArtistCents' | 'unitProductionCents' | 'unitGalleryCents' | 'quantity'>

/**
 * Order-insensitive stable key for a WizardConfig. Sorting the `values`
 * entries before serialising means two configs that differ only in insertion
 * order hash identically, so `sameLine` never creates spurious duplicates.
 * Also folds in customSize and borders so custom-size or border-only changes
 * correctly produce a new line rather than merging with an existing one.
 */
export function configKey(config: WizardConfig): string {
  const values = Object.fromEntries(
    Object.entries(config.values ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  )
  return JSON.stringify({
    values,
    customSize: config.customSize ?? null,
    borders: config.borders ?? null,
  })
}

export function lineTotal(item: MoneyParts): CartItemTotals {
  const unitItemCents = item.unitArtistCents + item.unitProductionCents + item.unitGalleryCents
  return { unitItemCents, lineItemCents: unitItemCents * item.quantity }
}

export function cartSubtotal(items: MoneyParts[]): number {
  return items.reduce((sum, i) => sum + lineTotal(i).lineItemCents, 0)
}

export function cartCount(items: Array<Pick<CartItem, 'quantity'>>): number {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}
