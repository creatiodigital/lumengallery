import { createSlice } from '@reduxjs/toolkit'

const wallViewSlice = createSlice({
  name: 'wallView',
  initialState: {
    isWallView: false,
    currentArtworkId: null,
    currentWallId: null,
  },
  reducers: {
    showWallView: (state, action) => {
      state.isWallView = true
      state.currentWallId = action.payload
    },
    hideWallView: (state) => {
      state.isWallView = false
      state.currentWallId = null
    },
    chooseCurrentArtworkId: (state, action) => {
      state.currentArtworkId = action.payload
    },
  },
})

export const {
  showWallView,
  hideWallView,
  chooseCurrentArtworkId,
  resetWallView,
} = wallViewSlice.actions
export default wallViewSlice.reducer
