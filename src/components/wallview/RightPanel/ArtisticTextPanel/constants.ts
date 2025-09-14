import type { TOption } from '@/types/artwork'

// Utility to create option arrays from plain arrays
function toOptions<T extends string | number>(values: readonly T[]): TOption<T>[] {
  return values.map((v) => ({
    value: v,
    label: String(v),
  }))
}

// Font sizes (8 → 24)
export const fontSizes = toOptions(
  Array.from({ length: 17 }, (_, i) => i + 8) as number[], // 8..24
)

// Line heights (1 → 2 in 0.1 steps)
export const lineHeights = toOptions(
  Array.from({ length: 11 }, (_, i) => +(1 + i * 0.1).toFixed(1)), // 1.0 .. 2.0
)

// Letter spacings
export const letterSpacings = toOptions([1, 1.5, 2] as const)

// Font weights
export const fontWeights: TOption<'regular' | 'bold'>[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
]

// Font families
export const fontFamilies: TOption<'roboto' | 'lora'>[] = [
  { value: 'roboto', label: 'Roboto' },
  { value: 'lora', label: 'Lora' },
]
