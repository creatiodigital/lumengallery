/**
 * Canonical wording for an edition's *type*, used on its own (e.g. stacked
 * above the variant name in the admin order items table) or as the prefix of
 * the combined `editionLabel` below. Keeping it here means the type wording
 * never drifts between the one-line and two-line presentations.
 *
 *   limited → "Limited Edition"
 *   open    → "Open Edition"
 */
export function editionTypeLabel(editionType: 'open' | 'limited'): string {
  return editionType === 'limited' ? 'Limited Edition' : 'Open Edition'
}

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
    return name ? `${editionTypeLabel('limited')} · ${name}` : editionTypeLabel('limited')
  }
  return editionTypeLabel('open')
}
