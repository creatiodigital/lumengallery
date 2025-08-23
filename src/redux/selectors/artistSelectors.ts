import { createSelector } from '@reduxjs/toolkit'

import type { RootState } from '../store'

export const selectExhibitions = createSelector(
  (state: RootState) => state.artist.allExhibitionIds,
  (state: RootState) => state.artist.exhibitionsById,
  (ids, byId) => ids.map((id) => byId[id]),
)
