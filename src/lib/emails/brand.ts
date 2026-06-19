// Brand tokens for transactional emails. Red appears ONLY in the marks.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'

export const EMAIL_BRAND = {
  red: '#bd1622',
  ink: '#111111',
  bodyText: '#444444',
  muted: '#8a8a8a',
  labelMuted: '#b9b9b9',
  valueText: '#555555',
  beige: '#faf9f6',
  hairline: '#eeeeee',
  pageBg: '#f2f2f2',
  fontStack: "Helvetica, 'Helvetica Neue', Arial, sans-serif",
  contentWidth: 600,
  // Absolute URLs — email clients can't resolve relative paths. PNG, not SVG.
  monogramUrl: `${SITE_URL}/email/monogram@2x.png`,
  wordmarkUrl: `${SITE_URL}/email/wordmark@2x.png`,
} as const

export const EMAIL_CONTACT = {
  mail: 'contact@theartroom.gallery',
  tel: '+34 665 05 99 41',
  web: 'theartroom.gallery',
} as const
