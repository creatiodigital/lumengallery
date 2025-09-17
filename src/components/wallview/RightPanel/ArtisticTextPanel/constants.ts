import type { TOption } from '@/types/artwork'

function toOptions<T extends string | number>(values: readonly T[]): TOption<T>[] {
  return values.map((v) => ({
    value: v,
    label: String(v),
  }))
}

export const fontSizes = toOptions(Array.from({ length: 17 }, (_, i) => i + 8) as number[])

export const lineHeights = toOptions(
  Array.from({ length: 11 }, (_, i) => +(1 + i * 0.1).toFixed(1)),
)

export const letterSpacings = toOptions([1, 1.5, 2] as const)

export const fontWeights: TOption<'regular' | 'bold'>[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
]

export const fontFamilies: TOption<'roboto' | 'lora'>[] = [
  { value: 'roboto', label: 'Roboto' },
  { value: 'lora', label: 'Lora' },
]
