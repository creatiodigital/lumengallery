import { createSelector } from '@reduxjs/toolkit'

import type { TExhibition } from '@/types/exhibition'

import type { RootState } from '../store'

/** Stable empty result, so a mismatch doesn't churn re-renders. */
const NO_EXHIBITIONS: TExhibition[] = []

/**
 * The loaded exhibitions, but ONLY if they belong to `userId`.
 *
 * The guard is in the selector rather than in each dashboard so it cannot be
 * forgotten by a caller. The store is global and survives client-side
 * navigation, so a plain read hands back whoever's list happened to be fetched
 * last — which is how an admin impersonating a second artist kept seeing the
 * first artist's exhibitions, permanently, whenever the new fetch failed.
 *
 * Returning empty on a mismatch means the dashboard shows nothing for the
 * instant before the right list arrives, which is correct: it does not yet know
 * what this user owns, and showing someone else's work is far worse than
 * showing none.
 */
export const selectExhibitionsForUser = createSelector(
  [
    (state: RootState) => state.user.ownerId,
    (state: RootState) => state.user.allExhibitionIds,
    (state: RootState) => state.user.exhibitionsById,
    (_state: RootState, userId: string | undefined) => userId,
  ],
  (ownerId, ids, byId, userId) =>
    userId && ownerId === userId ? ids.map((id) => byId[id]) : NO_EXHIBITIONS,
)
