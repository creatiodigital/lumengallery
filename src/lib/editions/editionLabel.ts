/**
 * Canonical human label for a print's edition, shared by every surface that
 * shows it (cart line, buyer confirmation email, admin order page) so the
 * wording never drifts between them.
 *
 *   limited + name → "Limited Edition · Medium"
 *   limited        → "Limited Edition"        (name not yet known)
 *   open           → "Open Edition"
 */
export function editionLabel(editionType: 'open' | 'limited', name?: string | null): string {
  if (editionType === 'limited') {
    return name ? `Limited Edition · ${name}` : 'Limited Edition'
  }
  return 'Open Edition'
}
