import type { NextFontWithVariable } from 'next/dist/compiled/@next/font'
import { Cabin, Fraunces, Roboto, Lora } from 'next/font/google'

// Each call returns NextFontWithVariable, so we can annotate explicitly
export const cabin: NextFontWithVariable = Cabin({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const fraunces: NextFontWithVariable = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
})

export const roboto: NextFontWithVariable = Roboto({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-wall1',
})

export const lora: NextFontWithVariable = Lora({
  subsets: ['latin'],
  variable: '--font-wall2',
})
