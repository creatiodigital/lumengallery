import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { wallViewFactory } from '@/factories/wallViewFactory'
import type { WallView, Coordinates, WallDimensions, ArtworkGroup } from '@/types/wallView'

const wallViewSlice = createSlice({
  name: 'wallView',
  initialState: wallViewFactory(),
  reducers: {
    showWallView: (state: WallView, action: PayloadAction<string>) => {
      state.isWallView = true
      state.currentWallId = action.payload
    },
    hideWallView: (state: WallView) => {
      state.isWallView = false
      state.currentWallId = null
    },
    showHuman: (state: WallView) => {
      state.isHumanVisible = true
    },
    hideHuman: (state: WallView) => {
      state.isHumanVisible = false
    },
    chooseCurrentArtworkId: (state: WallView, action: PayloadAction<string | null>) => {
      state.currentArtworkId = action.payload
    },
    increaseScaleFactor: (state: WallView) => {
      state.scaleFactor = Math.min(state.scaleFactor + 0.02, 2)
    },
    decreaseScaleFactor: (state: WallView) => {
      state.scaleFactor = Math.max(state.scaleFactor - 0.02, 0.64)
    },
    setPanPosition: (
      state: WallView,
      action: PayloadAction<{ deltaX: number; deltaY: number }>,
    ) => {
      const { deltaX, deltaY } = action.payload
      state.panPosition = {
        x: state.panPosition.x + deltaX * 100,
        y: state.panPosition.y + deltaY * 100,
      }
    },
    resetPan: (state: WallView) => {
      state.panPosition = { x: -50, y: -50 }
      state.scaleFactor = 1
    },
    setWallDimensions: (state: WallView, action: PayloadAction<WallDimensions>) => {
      const { width, height } = action.payload
      state.wallWidth = width
      state.wallHeight = height
    },
    setWallCoordinates: (
      state: WallView,
      action: PayloadAction<{ coordinates: Coordinates; normal: Coordinates }>,
    ) => {
      const { coordinates, normal } = action.payload
      state.currentWallCoordinates = coordinates
      state.currentWallNormal = normal
    },
    setAlignedPairs: (state: WallView, action: PayloadAction<unknown[]>) => {
      state.alignedPairs = action.payload
    },
    clearAlignedPairs: (state: WallView) => {
      state.alignedPairs = []
    },
    startDragging: (state: WallView) => {
      state.isDragging = true
    },
    stopDragging: (state: WallView) => {
      state.isDragging = false
    },
    startDraggingGroup: (state: WallView) => {
      state.isDraggingGroup = true
    },
    stopDraggingGroup: (state: WallView) => {
      state.isDraggingGroup = false
    },
    setShiftKeyDown: (state: WallView, action: PayloadAction<boolean>) => {
      state.isShiftKeyDown = action.payload
    },
    addArtworkToGroup: (state: WallView, action: PayloadAction<string>) => {
      state.artworkGroupIds.push(action.payload)
    },
    removeArtworkFromGroup: (state: WallView, action: PayloadAction<string>) => {
      state.artworkGroupIds = state.artworkGroupIds.filter((id) => id !== action.payload)
    },
    createArtworkGroup: (state: WallView, action: PayloadAction<ArtworkGroup>) => {
      state.artworkGroup = action.payload
    },
    editArtworkGroup: (
      state: WallView,
      action: PayloadAction<{ groupX?: number; groupY?: number }>,
    ) => {
      state.artworkGroup.groupX = action.payload.groupX
      state.artworkGroup.groupY = action.payload.groupY
    },
    removeGroup: (state: WallView) => {
      state.artworkGroupIds = []
    },
    setGroupHovered: (state: WallView) => {
      state.isGroupHovered = true
    },
    setGroupNotHovered: (state: WallView) => {
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
