/**
 * Remembers the page the buyer left to enter the print flow, so the wizard's
 * CLOSE/exit buttons can return them there instead of dumping them on /prints.
 *
 * Captured when "Order Print" is clicked (the current path — e.g. the exhibition
 * visit URL when opened from the in-exhibition artwork modal, or /artworks/<slug>
 * from the standalone page) and consumed by the first Close in the flow.
 *
 * Keyed by slug so a leftover value for one artwork can never misdirect the print
 * flow of another (e.g. entering print from /prints for a different artwork, which
 * records nothing of its own, correctly falls back to /prints).
 */
const keyFor = (slug: string) => `the-art-room:print-return:${slug}`

/** Record where the buyer is leaving from. Best-effort (no-op if sessionStorage is unavailable). */
export function setPrintReturnUrl(slug: string, path: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(keyFor(slug), path)
  } catch {
    // private mode / storage disabled — the flow falls back to /prints on close.
  }
}

/** Read and clear the remembered return page for this artwork. Null when none was recorded. */
export function consumePrintReturnUrl(slug: string): string | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const key = keyFor(slug)
    const url = sessionStorage.getItem(key)
    if (url) sessionStorage.removeItem(key)
    return url
  } catch {
    return null
  }
}
