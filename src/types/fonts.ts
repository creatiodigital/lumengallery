// types/fonts.ts
export const FONT_FAMILIES = ['roboto', 'lora'] as const
export type TFontFamily = (typeof FONT_FAMILIES)[number]

export const FONT_WEIGHTS = ['regular', 'bold'] as const
export type TFontWeight = (typeof FONT_WEIGHTS)[number]

export type TTextAlign = 'left' | 'center' | 'right'

export type TOption<T> = {
  value: T
  label: string
}
