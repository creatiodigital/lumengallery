import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { TExhibition } from '@/types/exhibition'

type UserExhibitionsState = {
  exhibitionsById: Record<string, TExhibition>
  allExhibitionIds: string[]
}

const initialState: UserExhibitionsState = {
  exhibitionsById: {},
  allExhibitionIds: [],
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    hydrateExhibitions: (state, action: PayloadAction<TExhibition[]>) => {
      state.exhibitionsById = {}
      state.allExhibitionIds = []
      for (const ex of action.payload) {
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
