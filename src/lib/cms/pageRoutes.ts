/**
 * Maps a CMS page slug (PageContent.slug) to its public route path.
 *
 * The slug and the URL deliberately differ (e.g. 'terms' →
 * '/terms-and-conditions'), so on-demand revalidation must translate:
 * revalidatePath needs the real route, not the slug. Used by the page
 * save + banner-image routes to purge the statically-rendered page when
 * an admin edits it.
 */
export const PAGE_ROUTE_BY_SLUG: Record<string, string> = {
  about: '/about',
  terms: '/terms-and-conditions',
  'sale-terms': '/terms-of-sale',
  privacy: '/privacy-policy',
  accessibility: '/accessibility-policy',
  prints: '/prints',
}
