import { createSlice } from '@reduxjs/toolkit'

const wallViewSlice = createSlice({
  name: 'wallView',
  initialState: {
    isWallView: false,
    currentArtworkId: null,
    currentWallId: null,
    currentWallCoordinates: { x: 0, y: 0, z: 0 },
    currentWallNormal: { x: 0, y: 0, z: 1 },
    scaleFactor: 1,
    panPosition: { x: -50, y: -50 },
    isPersonVisible: false,
    wallHeight: null,
    wallWidth: null,
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
    showPerson: (state) => {
      state.isPersonVisible = true
    },
    hidePerson: (state) => {
      state.isPersonVisible = false
    },
    chooseCurrentArtworkId: (state, action) => {
      state.currentArtworkId = action.payload
    },
    increaseScaleFactor: (state) => {
      state.scaleFactor = Math.min(state.scaleFactor + 0.02, 2)
    },
    decreaseScaleFactor: (state) => {
      state.scaleFactor = Math.max(state.scaleFactor - 0.02, 0.64)
    },
    setPanPosition: (state, action) => {
      const deltaX = action.payload.deltaX
      const deltaY = action.payload.deltaY
      const newPosition = {
        x: state.panPosition.x + deltaX * 100,
        y: state.panPosition.y + deltaY * 100,
      }
      state.panPosition = newPosition
    },
    resetPan: (state) => {
      state.panPosition = { x: -50, y: -50 }
      state.scaleFactor = 1
    },
    setWallDimensions: (state, action) => {
      const { width, height } = action.payload
      state.wallWidth = width
      state.wallHeight = height
    },
    setWallCoordinates: (state, action) => {
      const { coordinates, normal } = action.payload
      state.currentWallCoordinates = coordinates
      state.currentWallNormal = { x: normal.x, y: normal.y, z: normal.z }
    },
  },
})

export const {
  showWallView,
  hideWallView,
  showPerson,
  hidePerson,
  chooseCurrentArtworkId,
  resetWallView,
  increaseScaleFactor,
  decreaseScaleFactor,
  setPanPosition,
  resetPan,
  setWallDimensions,
  setWallCoordinates,
} = wallViewSlice.actions
export default wallViewSlice.reducer
