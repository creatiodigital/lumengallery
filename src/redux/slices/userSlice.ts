import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'

import { createUserState } from '@/factories/userFactory'
import type { TExhibition } from '@/types/exhibition'
import type { TUser, TUserState } from '@/types/user'

export const fetchUser = createAsyncThunk<TUser, string>('user/fetchUser', async (id) => {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) throw new Error('Fetch failed')
  return res.json() as Promise<TUser>
})

export const fetchExhibitionsByUser = createAsyncThunk<TExhibition[], string>(
  'user/fetchExhibitionsByUser',
  async (userId) => {
    const res = await fetch(`/api/exhibitions?userId=${userId}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Failed to fetch exhibitions')
    return res.json() as Promise<TExhibition[]>
  },
)

const userSlice = createSlice({
  name: 'user',
  initialState: createUserState(),
  reducers: {
    addExhibition: (state: TUserState, action: PayloadAction<TExhibition>) => {
      const exhibition = action.payload
      state.exhibitionsById[exhibition.id] = exhibition

      if (!state.allExhibitionIds.includes(exhibition.id)) {
        state.allExhibitionIds.push(exhibition.id)
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state: TUserState) => {
        state.status = 'loading'
      })
      .addCase(fetchUser.fulfilled, (state: TUserState, action: PayloadAction<TUser>) => {
        state.status = 'succeeded'
        const user = action.payload
        state.id = user.id
        state.name = user.name
        state.lastName = user.lastName
        state.handler = user.handler
        state.biography = user.biography
      })
      .addCase(fetchUser.rejected, (state: TUserState, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? 'Unknown error'
      })
      .addCase(
        fetchExhibitionsByUser.fulfilled,
        (state: TUserState, action: PayloadAction<TExhibition[]>) => {
          state.exhibitionsById = {}
          state.allExhibitionIds = []

          for (const ex of action.payload) {
            state.exhibitionsById[ex.id] = ex
            state.allExhibitionIds.push(ex.id)
          }
        },
      )
  },
})

export const { addExhibition } = userSlice.actions
export default userSlice.reducer
