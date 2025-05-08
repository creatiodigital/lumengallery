import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

// Thunks
export const fetchArtist = createAsyncThunk('artist/fetchArtist', async (handler) => {
  const res = await fetch(`/api/artist?handler=${handler}`)
  if (!res.ok) throw new Error('Fetch failed')
  return res.json()
})

export const createArtist = createAsyncThunk(
  'artist/createArtist',
  async ({ name, lastName, handler, biography }) => {
    const res = await fetch('/api/artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, lastName, handler, biography }),
    })
    if (!res.ok) throw new Error('Create failed')
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
  },
  reducers: {
    setHandler: (s, a) => {
      s.handler = a.payload
    },
  },
  extraReducers: (b) => {
    b
      // fetch
      .addCase(fetchArtist.pending, (s) => {
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
      // create
      .addCase(createArtist.pending, (s) => {
        s.status = 'loading'
      })
      .addCase(createArtist.fulfilled, (s, a) => {
        s.status = 'succeeded'
        Object.assign(s, a.payload)
      })
      .addCase(createArtist.rejected, (s, a) => {
        s.status = 'failed'
        s.error = a.error.message
      })
  },
})

export const { setHandler } = artistSlice.actions
export default artistSlice.reducer
