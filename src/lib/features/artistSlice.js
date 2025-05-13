import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

export const fetchArtist = createAsyncThunk('artist/fetchArtist', async (id) => {
  const res = await fetch(`/api/artists/${id}`)
  if (!res.ok) throw new Error('Fetch failed')
  return res.json()
})

export const fetchExhibitionsByArtist = createAsyncThunk(
  'artist/fetchExhibitionsByArtist',
  async (userId) => {
    const res = await fetch(`/api/exhibitions?userId=${userId}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Failed to fetch exhibitions')
    return res.json()
  },
)

const artistSlice = createSlice({
  name: 'artist',
  initialState: {
    id: '',
    name: '',
    lastName: '',
    handler: '',
    biography: '',
    status: 'idle',
    error: null,
    exhibitionsById: {},
    allExhibitionIds: [],
  },
  reducers: {
    addExhibition: (state, action) => {
      const exhibition = action.payload
      const id = exhibition.id
      state.exhibitionsById[id] = exhibition

      if (!state.allExhibitionIds.includes(id)) {
        state.allExhibitionIds.push(id)
      }
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchArtist.pending, (s) => {
      s.status = 'loading'
    })
      .addCase(fetchArtist.fulfilled, (s, a) => {
        s.status = 'succeeded'
        Object.assign(s, a.payload)
      })
      .addCase(fetchArtist.rejected, (s, a) => {
        s.status = 'failed'
        s.error = a.error.message
      })
      .addCase(fetchExhibitionsByArtist.fulfilled, (state, action) => {
        const exhibitions = action.payload
        state.exhibitionsById = {}
        state.allExhibitionIds = []

        for (const ex of exhibitions) {
          state.exhibitionsById[ex.id] = ex
          state.allExhibitionIds.push(ex.id)
        }
      })
  },
})

export const { addExhibition } = artistSlice.actions

export default artistSlice.reducer
