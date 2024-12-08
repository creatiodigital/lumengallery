import { createSlice } from '@reduxjs/toolkit'

const wallViewSlice = createSlice({
  name: 'wallView',
  initialState: {
    isWallView: false,
    currentArtworkId: null,
    currentWallId: null,
    scaleFactor: 1,
    panPosition: { x: -50, y: -50 },
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
    increaseScaleFactor: (state) => {
      state.scaleFactor =  Math.min(state.scaleFactor + 0.02, 1.5)
    },
    decreaseScaleFactor: (state) => {
      state.scaleFactor =  Math.max(state.scaleFactor - 0.02, 0.54)
    },
    setPanPosition: (state, action) => {
      const deltaX = action.payload.deltaX;
      const deltaY = action.payload.deltaY;
      const newPosition = {x: state.panPosition.x + deltaX * 100, y: state.panPosition.y + deltaY * 100}
      state.panPosition = newPosition
    },
    resetPan: (state) => {
      state.panPosition = { x: -50, y: -50 }
    }
  },
})

export const {
  showWallView,
  hideWallView,
  chooseCurrentArtworkId,
  resetWallView,
  increaseScaleFactor,
  decreaseScaleFactor,
  setPanPosition,
  resetPan
} = wallViewSlice.actions
export default wallViewSlice.reducer
