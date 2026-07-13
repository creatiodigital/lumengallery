import { Lato, EB_Garamond, Geist, Roboto, Lora, Alegreya, Manrope, Caveat } from 'next/font/google'
import localFont from 'next/font/local'

/**
 * Caveat — handwriting font for the limited-edition number ("1/50")
 * rendered bottom-left on the print preview, matching theprintspace's
 * on-print numbering style. Exposed as the `--font-caveat` CSS variable.
 */
export const editionNumberFont = Caveat({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-caveat',
  display: 'swap',
  // Print-preview only — never used on public pages. Don't preload it on
  // every route; it loads on demand when the print wizard renders. (AR-132 perf)
  preload: false,
})

// =============================================================================
// MAIN TYPOGRAPHY - Change these to swap fonts across the entire site
// =============================================================================

/**
 * Body font - Used for: text, navigation, forms, labels, lists, UI elements
 * Current: Lato
 * To change: Replace Lato with any Google font and update the variable name if needed
 *
 * `display: 'optional'` — the browser waits ~100ms for the font; if it
 * hasn't arrived, the size-adjusted fallback is used for the whole
 * pageview, eliminating font-swap CLS. Trade-off: slow-connection
 * visitors may not see the brand font on first paint.
 */
export const bodyFont = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-sans',
  display: 'optional',
})

/**
 * Heading font - Used for: h1, h2, h3, h4, h5, h6 and all `*Serif` text
 * (the `--font-serif` token). Current: EB Garamond.
 * To change: Replace EB_Garamond with any Google font.
 *
 * `display: 'optional'` — see note on bodyFont. Headings are the most
 * visible font-swap CLS source because heading sizes amplify metric
 * differences between fallback and webfont.
 */
export const headingFont = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'optional',
})

/**
 * Dashboard font - Used for: all dashboard pages (artist, admin, settings, etc.)
 * Current: Geist
 * To change: Replace Geist with any Google font
 */
export const dashboardFont = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-dashboard',
  display: 'swap',
  // Used across dashboard/admin (and Button/Typography). Keep it available
  // sitewide via the CSS var, but don't eagerly preload it on public routes —
  // it loads on demand. (AR-132 perf)
  preload: false,
})

// =============================================================================
// 2D WALL VIEW FONTS - Used only in the exhibition editor 2D preview
// preload: false — these load only when the editor renders, never on public
// pages, so they must not preload on every route. (AR-132 perf)
// =============================================================================

export const wallFont1 = Roboto({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-wall-roboto',
  display: 'swap',
  preload: false,
})

export const wallFont2 = Lora({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-wall-lora',
  display: 'swap',
  preload: false,
})

export const wallFont3 = Alegreya({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-wall-alegreya',
  display: 'swap',
  preload: false,
})

export const wallFont4 = Manrope({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-wall-manrope',
  display: 'swap',
  preload: false,
})

export const wallFont5 = localFont({
  src: '../../public/fonts/garamont-glc.ttf',
  variable: '--font-wall-garamond-glc',
  display: 'swap',
  preload: false,
})

export const wallFont6 = localFont({
  src: [
    { path: '../../public/fonts/crimson-regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/crimson-italic.ttf', weight: '400', style: 'italic' },
    { path: '../../public/fonts/crimson-bold.ttf', weight: '700', style: 'normal' },
    { path: '../../public/fonts/crimson-bold-italic.ttf', weight: '700', style: 'italic' },
  ],
  variable: '--font-wall-crimson',
  display: 'swap',
  preload: false,
})
