// Brand tokens for transactional emails. Red appears ONLY in the marks.

// Absolute-URL base for email assets and links. Explicit env wins; otherwise
// production uses the real domain and EVERY other environment (staging,
// localhost, previews) uses staging: Gmail's image proxy can't reach
// localhost, and staging shares the dev database, so both the brand marks
// and the links inside test emails resolve against the data the email
// describes. Production needs no env at all.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_APP_ENV === 'production'
    ? 'https://theartroom.gallery'
    : 'https://staging.theartroom.gallery')

export const EMAIL_BRAND = {
  red: '#bd1622',
  ink: '#111111',
  // Greys kept dark enough for WCAG AA on white (>= 4.5:1): bodyText/valueText
  // ~12.6:1, muted ~7:1. Avoid lighter greys — they fail contrast.
  bodyText: '#333333',
  muted: '#595959',
  valueText: '#333333',
  beige: '#faf9f6',
  hairline: '#eeeeee',
  pageBg: '#f2f2f2',
  fontStack: "Helvetica, 'Helvetica Neue', Arial, sans-serif",
  contentWidth: 600,
  // Base origin for absolute asset/link URLs. Defaults to prod; the dev
  // preview route rewrites this to the request origin so marks load locally.
  siteUrl: SITE_URL,
  // Absolute URLs — email clients can't resolve relative paths. PNG, not SVG.
  monogramUrl: `${SITE_URL}/email/monogram@2x.png`,
  wordmarkUrl: `${SITE_URL}/email/wordmark@2x.png`,
} as const

export const EMAIL_CONTACT = {
  mail: 'contact@theartroom.gallery',
  tel: '+34 665 05 99 41',
  web: 'theartroom.gallery',
} as const
