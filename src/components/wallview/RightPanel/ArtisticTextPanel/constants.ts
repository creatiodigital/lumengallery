import type { TOption } from '@/types/artwork'

export const fontSizes = [
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
  { label: '11', value: 11 },
  { label: '12', value: 12 },
  { label: '13', value: 13 },
  { label: '14', value: 14 },
  { label: '15', value: 15 },
  { label: '16', value: 16 },
  { label: '17', value: 17 },
  { label: '18', value: 18 },
  { label: '19', value: 19 },
  { label: '20', value: 20 },
  { label: '21', value: 21 },
  { label: '22', value: 22 },
  { label: '23', value: 23 },
  { label: '24', value: 24 },
]
export const lineHeights = [
  { label: '1', value: 1 },
  { label: '1.1', value: 1.1 },
  { label: '1.2', value: 1.2 },
  { label: '1.3', value: 1.3 },
  { label: '1.4', value: 1.4 },
  { label: '1.5', value: 1.5 },
  { label: '1.6', value: 1.6 },
  { label: '1.7', value: 1.7 },
  { label: '1.8', value: 1.8 },
  { label: '1.9', value: 1.9 },
  { label: '2', value: 2 },
]
export const fontWeights: TOption<'regular' | 'bold'>[] = [
  { label: 'Regular', value: 'regular' },
  { label: 'Bold', value: 'bold' },
]
export const fontFamilies: TOption<'roboto' | 'lora'>[] = [
  { label: 'Roboto', value: 'roboto' },
  { label: 'Lora', value: 'lora' },
]
export const letterSpacings = [
  { label: '1', value: 1 },
  { label: '1.5', value: 1.5 },
  { label: '2', value: 2 },
]
