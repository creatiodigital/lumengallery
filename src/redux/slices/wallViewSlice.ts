import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { wallViewFactory } from '@/factories/wallViewFactory'
import type { TWallView, TCoordinates, TWallDimensions, TArtworkGroup } from '@/types/wallView'

const wallViewSlice = createSlice({
  name: 'wallView',
  initialState: wallViewFactory(),
  reducers: {
    showWallView: (state: TWallView, action: PayloadAction<string>) => {
      state.isWallView = true
      state.currentWallId = action.payload
    },
    hideWallView: (state: TWallView) => {
      state.isWallView = false
      state.currentWallId = null
    },
    showHuman: (state: TWallView) => {
      state.isHumanVisible = true
    },
    hideHuman: (state: TWallView) => {
      state.isHumanVisible = false
    },
    chooseCurrentArtworkId: (state: TWallView, action: PayloadAction<string | null>) => {
      state.currentArtworkId = action.payload
    },
    increaseScaleFactor: (state: TWallView) => {
      state.scaleFactor = Math.min(state.scaleFactor + 0.02, 2)
    },
    decreaseScaleFactor: (state: TWallView) => {
      state.scaleFactor = Math.max(state.scaleFactor - 0.02, 0.64)
    },
    setPanPosition: (
      state: TWallView,
      action: PayloadAction<{ deltaX: number; deltaY: number }>,
    ) => {
      const { deltaX, deltaY } = action.payload
      state.panPosition = {
        x: state.panPosition.x + deltaX * 100,
        y: state.panPosition.y + deltaY * 100,
      }
    },
    resetPan: (state: TWallView) => {
      state.panPosition = { x: -50, y: -50 }
      state.scaleFactor = 1
    },
    setWallDimensions: (state: TWallView, action: PayloadAction<TWallDimensions>) => {
      const { width, height } = action.payload
      state.wallWidth = width
      state.wallHeight = height
    },
    setWallCoordinates: (
      state: TWallView,
      action: PayloadAction<{ coordinates: TCoordinates; normal: TCoordinates }>,
    ) => {
      const { coordinates, normal } = action.payload
      state.currentWallCoordinates = coordinates
      state.currentWallNormal = normal
    },
    setAlignedPairs: (state: TWallView, action: PayloadAction<unknown[]>) => {
      state.alignedPairs = action.payload
    },
    clearAlignedPairs: (state: TWallView) => {
      state.alignedPairs = []
    },
    startDragging: (state: TWallView) => {
      state.isDragging = true
    },
    stopDragging: (state: TWallView) => {
      state.isDragging = false
    },
    startDraggingGroup: (state: TWallView) => {
      state.isDraggingGroup = true
    },
    stopDraggingGroup: (state: TWallView) => {
      state.isDraggingGroup = false
    },
    setShiftKeyDown: (state: TWallView, action: PayloadAction<boolean>) => {
      state.isShiftKeyDown = action.payload
    },
    addArtworkToGroup: (state: TWallView, action: PayloadAction<string>) => {
      state.artworkGroupIds.push(action.payload)
    },
    removeArtworkFromGroup: (state: TWallView, action: PayloadAction<string>) => {
      state.artworkGroupIds = state.artworkGroupIds.filter((id) => id !== action.payload)
    },
    createArtworkGroup: (state: TWallView, action: PayloadAction<TArtworkGroup>) => {
      state.artworkGroup = action.payload
    },
    editArtworkGroup: (
      state: TWallView,
      action: PayloadAction<{ groupX?: number; groupY?: number }>,
    ) => {
      state.artworkGroup.groupX = action.payload.groupX
      state.artworkGroup.groupY = action.payload.groupY
    },
    removeGroup: (state: TWallView) => {
      state.artworkGroupIds = []
    },
    setGroupHovered: (state: TWallView) => {
      state.isGroupHovered = true
    },
    setGroupNotHovered: (state: TWallView) => {
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
