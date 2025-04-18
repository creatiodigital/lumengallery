import { createSlice } from '@reduxjs/toolkit'

const artistSlice = createSlice({
  name: 'artist',
  initialState: {
    id: '123456',
    name: 'Eduardo',
    lastName: 'Plaza',
    biography: '',
    handler: 'eduardo-plaza',
  },
  reducers: {
    setHandler: (state, action) => {
      state.handler = action.payload
    },
  },
})

export const { setHandler, addWall, editWallName } = artistSlice.actions
export default artistSlice.reducer
