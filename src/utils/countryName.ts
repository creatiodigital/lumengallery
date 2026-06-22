/**
 * Resolves an ISO-3166 alpha-2 country code (e.g. "AT") to its English
 * display name (e.g. "Austria") via Intl.DisplayNames. Used wherever a
 * buyer or operator sees a country — buyer emails, the admin order page —
 * so we never surface a bare two-letter code.
 *
 * Falls back to the input unchanged when it isn't a 2-letter code, when the
 * code is unknown, or if Intl.DisplayNames throws — so a malformed value is
 * shown as-is rather than blanked. Runs identically on server (webhook email
 * builders) and client (admin UI); Node 18+ and modern browsers both ship the
 * full ICU region data this needs.
 */
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

export function countryName(code?: string | null): string {
  if (!code) return ''
  const trimmed = code.trim()
  // Only ISO alpha-2 codes resolve; anything else (already a full name, or
  // junk) passes through untouched.
  if (trimmed.length !== 2) return trimmed
  try {
    return regionNames.of(trimmed.toUpperCase()) ?? trimmed
  } catch {
    return trimmed
  }
}
