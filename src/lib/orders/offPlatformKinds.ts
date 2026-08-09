/**
 * Kinds of off-platform edition copies — numbers consumed by hand from the
 * admin ledger without a Stripe order (gallery gifts, artist-retained copies,
 * test prints). Shared by the server action (`markOffPlatformCopy`) and the
 * admin UI. Lives outside the `'use server'` actions module, which may only
 * export async functions.
 */
export const OFF_PLATFORM_KINDS = ['gift', 'artist_copy', 'test'] as const
export type OffPlatformKind = (typeof OFF_PLATFORM_KINDS)[number]
export const OFF_PLATFORM_KIND_LABELS: Record<OffPlatformKind, string> = {
  gift: 'Gallery gift',
  artist_copy: 'Artist copy',
  test: 'Test print',
}
