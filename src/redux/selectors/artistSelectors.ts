import { createSelector } from '@reduxjs/toolkit'

import type { RootState } from '../store'

export const selectExhibitions = createSelector(
  (state: RootState) => state.user.allExhibitionIds,
  (state: RootState) => state.user.exhibitionsById,
  (ids, byId) => ids.map((id) => byId[id]),
)
