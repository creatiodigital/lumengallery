import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'

import { createUserState } from '@/factories/userFactory'
import type { ExhibitionType } from '@/types/exhibition'
import type { UserType, UserStateType } from '@/types/user'

export const fetchUser = createAsyncThunk<UserType, string>('user/fetchUser', async (id) => {
  console.log('id', id)
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) throw new Error('Fetch failed')
  return res.json() as Promise<UserType>
})

export const fetchExhibitionsByUser = createAsyncThunk<ExhibitionType[], string>(
  'user/fetchExhibitionsByUser',
  async (userId) => {
    const res = await fetch(`/api/exhibitions?userId=${userId}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Failed to fetch exhibitions')
    return res.json() as Promise<ExhibitionType[]>
  },
)

const userSlice = createSlice({
  name: 'user',
  initialState: createUserState(),
  reducers: {
    addExhibition: (state: UserStateType, action: PayloadAction<ExhibitionType>) => {
      const exhibition = action.payload
      state.exhibitionsById[exhibition.id] = exhibition

      if (!state.allExhibitionIds.includes(exhibition.id)) {
        state.allExhibitionIds.push(exhibition.id)
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state: UserStateType) => {
        state.status = 'loading'
      })
      .addCase(fetchUser.fulfilled, (state: UserStateType, action: PayloadAction<UserType>) => {
        state.status = 'succeeded'
        const user = action.payload
        state.id = user.id
        state.name = user.name
        state.lastName = user.lastName
        state.handler = user.handler
        state.biography = user.biography
      })
      .addCase(fetchUser.rejected, (state: UserStateType, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? 'Unknown error'
      })
      .addCase(
        fetchExhibitionsByUser.fulfilled,
        (state: UserStateType, action: PayloadAction<ExhibitionType[]>) => {
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
