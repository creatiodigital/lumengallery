/**
 * Translate a stored limited-edition variant into the canonical
 * `WizardConfig` the rest of the print pipeline already understands.
 *
 * This is the load-bearing adapter for the whole limited-edition path:
 * because checkout, pricing (`getPrintspaceQuote`), order creation and
 * the admin specs panel are all `WizardConfig`-driven, a limited variant
 * is just a *server-pinned* config. The limited flow therefore only
 * changes how the buyer selects (pick a variant) and adds numbering on
 * top — it never forks the pricing/order machinery.
 *
 * Limited variants are always print-only (never framed); the dimension
 * ids here (`printType`, `paper`, `format`, `size` via `customSize`,
 * `border`) match the TPS catalog in `printspace/buildCatalog.ts`.
 */
import type { WizardConfig } from '@/lib/print-providers/types'

export type VariantConfigInput = {
  paperId: string
  printTypeId: string
  widthCm: number
  heightCm: number
  borderCm: number
}

export function variantToWizardConfig(variant: VariantConfigInput): WizardConfig {
  return {
    values: {
      printType: variant.printTypeId,
      paper: variant.paperId,
      format: 'print-only',
    },
    customSize: { widthCm: variant.widthCm, heightCm: variant.heightCm },
    borders: { border: { allCm: variant.borderCm } },
  }
}
