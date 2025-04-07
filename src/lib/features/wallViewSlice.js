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
    isHumanVisible: false,
    wallHeight: null,
    wallWidth: null,
    isDragging: false,
    isDraggingGroup: false,
    isShiftKeyDown: false,
    artworkGroupIds: [],
    artworkGroup: {},
    isGroupHovered: false,
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
    showHuman: (state) => {
      state.isHumanVisible = true
    },
    hideHuman: (state) => {
      state.isHumanVisible = false
    },
    chooseCurrentArtworkId: (state, action) => {
      console.log('chooseCurrentArtworkId', action.payload)
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
    setAlignedPairs: (state, action) => {
      state.alignedPairs = action.payload
    },
    clearAlignedPairs: (state) => {
      state.alignedPairs = []
    },
    startDragging: (state) => {
      state.isDragging = true
    },
    stopDragging: (state) => {
      state.isDragging = false
    },
    startDraggingGroup: (state) => {
      state.isDraggingGroup = true
    },
    stopDraggingGroup: (state) => {
      state.isDraggingGroup = false
    },
    setShiftKeyDown: (state, action) => {
      state.isShiftKeyDown = action.payload
    },
    addArtworkToGroup: (state, action) => {
      state.artworkGroupIds.push(action.payload)
    },
    removeArtworkFromGroup: (state, action) => {
      const filteredGroup = state.artworkGroupIds.filter((artwork) => artwork !== action.payload)
      state.artworkGroupIds = filteredGroup
    },
    createArtworkGroup: (state, action) => {
      state.artworkGroup = action.payload
    },
    editArtworkGroup: (state, action) => {
      state.artworkGroup.groupX = action.payload.groupX
      state.artworkGroup.groupY = action.payload.groupY
    },
    removeGroup: (state) => {
      state.artworkGroupIds = []
    },
    setGroupHovered: (state) => {
      state.isGroupHovered = true
    },
    setGroupNotHovered: (state) => {
      state.isGroupHovered = false
    },
  },
})

export const {
  showWallView,
  hideWallView,
  showHuman,
  hideHuman,
  chooseCurrentArtworkId,
  resetWallView,
  increaseScaleFactor,
  decreaseScaleFactor,
  setPanPosition,
  resetPan,
  setWallDimensions,
  setWallCoordinates,
  setAlignedPairs,
  clearAlignedPairs,
  startDragging,
  stopDragging,
  startDraggingGroup,
  stopDraggingGroup,
  createArtworkGroup,
  editArtworkGroup,
  addArtworkToGroup,
  removeArtworkFromGroup,
  setShiftKeyDown,
  removeGroup,
  setGroupHovered,
  setGroupNotHovered,
} = wallViewSlice.actions
export default wallViewSlice.reducer
