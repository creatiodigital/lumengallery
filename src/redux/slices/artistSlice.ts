import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'

import { createArtistState } from '@/factories/artistFactory'
import type { Artist, ArtistState } from '@/types/artist'
import type { Exhibition } from '@/types/exhibition'

export const fetchArtist = createAsyncThunk<Artist, string>('artist/fetchArtist', async (id) => {
  const res = await fetch(`/api/artists/${id}`)
  if (!res.ok) throw new Error('Fetch failed')
  return res.json() as Promise<Artist>
})

export const fetchExhibitionsByArtist = createAsyncThunk<Exhibition[], string>(
  'artist/fetchExhibitionsByArtist',
  async (userId) => {
    const res = await fetch(`/api/exhibitions?userId=${userId}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Failed to fetch exhibitions')
    return res.json() as Promise<Exhibition[]>
  },
)

const artistSlice = createSlice({
  name: 'artist',
  initialState: createArtistState(),
  reducers: {
    addExhibition: (state: ArtistState, action: PayloadAction<Exhibition>) => {
      const exhibition = action.payload
      state.exhibitionsById[exhibition.id] = exhibition

      if (!state.allExhibitionIds.includes(exhibition.id)) {
        state.allExhibitionIds.push(exhibition.id)
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchArtist.pending, (state: ArtistState) => {
        state.status = 'loading'
      })
      .addCase(fetchArtist.fulfilled, (state: ArtistState, action: PayloadAction<Artist>) => {
        state.status = 'succeeded'
        const artist = action.payload
        state.id = artist.id
        state.name = artist.name
        state.lastName = artist.lastName
        state.handler = artist.handler
        state.biography = artist.biography
      })
      .addCase(fetchArtist.rejected, (state: ArtistState, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? 'Unknown error'
      })
      .addCase(
        fetchExhibitionsByArtist.fulfilled,
        (state: ArtistState, action: PayloadAction<Exhibition[]>) => {
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

export const { addExhibition } = artistSlice.actions
export default artistSlice.reducer
