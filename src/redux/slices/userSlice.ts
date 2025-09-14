// src/redux/slices/userSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createUserState } from '@/factories/userFactory'
import type { TExhibition } from '@/types/exhibition'
import type { TUser } from '@/types/user'

const userSlice = createSlice({
  name: 'user',
  initialState: createUserState(),
  reducers: {
    hydrateUser: (state, action: PayloadAction<TUser>) => {
      const user = action.payload
      state.id = user.id
      state.name = user.name
      state.lastName = user.lastName
      state.handler = user.handler
      state.biography = user.biography
    },
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
  },
})

export const { hydrateUser, hydrateExhibitions, addExhibition } = userSlice.actions
export default userSlice.reducer
