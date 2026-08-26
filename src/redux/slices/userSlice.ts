import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { TExhibition } from '@/types/exhibition'

type UserExhibitionsState = {
  /**
   * WHOSE exhibitions these are. Null until something has been loaded.
   *
   * This store is global and survives client-side navigation, so without an
   * owner the list outlives the user it belongs to. An admin impersonating a
   * second artist kept seeing the first artist's exhibitions under the new
   * artist's banner — indefinitely, because the list is only replaced when a
   * fetch SUCCEEDS, and one failed request left the stale one in place.
   *
   * A hard reload rebuilds the store and hid the whole thing, which is why it
   * only ever appeared when moving around the admin screens by clicking.
   *
   * Read through `selectExhibitionsForUser`, which refuses to hand back a list
   * whose owner is not the user being asked about.
   */
  ownerId: string | null
  exhibitionsById: Record<string, TExhibition>
  allExhibitionIds: string[]
}

const initialState: UserExhibitionsState = {
  ownerId: null,
  exhibitionsById: {},
  allExhibitionIds: [],
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    /** Replace the list, recording whose it is. */
    hydrateExhibitions: (
      state,
      action: PayloadAction<{ ownerId: string; exhibitions: TExhibition[] }>,
    ) => {
      state.ownerId = action.payload.ownerId
      state.exhibitionsById = {}
      state.allExhibitionIds = []
      for (const ex of action.payload.exhibitions) {
        state.exhibitionsById[ex.id] = ex
        state.allExhibitionIds.push(ex.id)
      }
    },
    addExhibition: (state, action: PayloadAction<TExhibition>) => {
      const ex = action.payload
      state.exhibitionsById[ex.id] = ex
      if (!state.allExhibitionIds.includes(ex.id)) {
        state.allExhibitionIds.push(ex.id)
      }
    },
    removeExhibition: (state, action: PayloadAction<string>) => {
      const id = action.payload
      delete state.exhibitionsById[id]
      state.allExhibitionIds = state.allExhibitionIds.filter((exId) => exId !== id)
    },
  },
})

export const { hydrateExhibitions, addExhibition, removeExhibition } = userSlice.actions
export default userSlice.reducer
