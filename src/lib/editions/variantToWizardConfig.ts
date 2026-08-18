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
import { computeSheetLayout, isFixedSheet } from '@/lib/editions/sheetLayout'
import type { WizardConfig } from '@/lib/print-providers/types'

export type VariantConfigInput = {
  paperId: string
  printTypeId: string
  widthCm: number
  heightCm: number
  borderCm: number
  /** Fixed-sheet mode: total sheet size in cm. See LimitedVariantView. */
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
}

export function variantToWizardConfig(variant: VariantConfigInput): WizardConfig {
  const config: WizardConfig = {
    values: {
      printType: variant.printTypeId,
      paper: variant.paperId,
      format: 'print-only',
    },
    customSize: { widthCm: variant.widthCm, heightCm: variant.heightCm },
    borders: { border: { allCm: variant.borderCm } },
  }

  // Fixed-sheet variants have different horizontal and vertical borders.
  // `allCm` stays the horizontal value (what every existing consumer and
  // the TPS field expect); the vertical one rides alongside so the
  // previewers can draw the real sheet shape.
  if (isFixedSheet(variant)) {
    const layout = computeSheetLayout({
      sheetWidthCm: variant.sheetWidthCm as number,
      sheetHeightCm: variant.sheetHeightCm as number,
      minBorderCm: variant.borderCm,
      aspectRatio: variant.widthCm / variant.heightCm,
    })
    if (layout) {
      config.borders = {
        ...config.borders,
        border: { allCm: layout.borderXCm, verticalCm: layout.borderYCm },
      }
    }
  }

  return config
}
