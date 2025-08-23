import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { wallViewFactory } from '@/factories/wallViewFactory'
import type {
  WallViewType,
  CoordinatesType,
  WallDimensionsType,
  ArtworkGroupType,
} from '@/types/wallView'

const wallViewSlice = createSlice({
  name: 'wallView',
  initialState: wallViewFactory(),
  reducers: {
    showWallView: (state: WallViewType, action: PayloadAction<string>) => {
      state.isWallView = true
      state.currentWallId = action.payload
    },
    hideWallView: (state: WallViewType) => {
      state.isWallView = false
      state.currentWallId = null
    },
    showHuman: (state: WallViewType) => {
      state.isHumanVisible = true
    },
    hideHuman: (state: WallViewType) => {
      state.isHumanVisible = false
    },
    chooseCurrentArtworkId: (state: WallViewType, action: PayloadAction<string | null>) => {
      state.currentArtworkId = action.payload
    },
    increaseScaleFactor: (state: WallViewType) => {
      state.scaleFactor = Math.min(state.scaleFactor + 0.02, 2)
    },
    decreaseScaleFactor: (state: WallViewType) => {
      state.scaleFactor = Math.max(state.scaleFactor - 0.02, 0.64)
    },
    setPanPosition: (
      state: WallViewType,
      action: PayloadAction<{ deltaX: number; deltaY: number }>,
    ) => {
      const { deltaX, deltaY } = action.payload
      state.panPosition = {
        x: state.panPosition.x + deltaX * 100,
        y: state.panPosition.y + deltaY * 100,
      }
    },
    resetPan: (state: WallViewType) => {
      state.panPosition = { x: -50, y: -50 }
      state.scaleFactor = 1
    },
    setWallDimensions: (state: WallViewType, action: PayloadAction<WallDimensionsType>) => {
      const { width, height } = action.payload
      state.wallWidth = width
      state.wallHeight = height
    },
    setWallCoordinates: (
      state: WallViewType,
      action: PayloadAction<{ coordinates: CoordinatesType; normal: CoordinatesType }>,
    ) => {
      const { coordinates, normal } = action.payload
      state.currentWallCoordinates = coordinates
      state.currentWallNormal = normal
    },
    setAlignedPairs: (state: WallViewType, action: PayloadAction<unknown[]>) => {
      state.alignedPairs = action.payload
    },
    clearAlignedPairs: (state: WallViewType) => {
      state.alignedPairs = []
    },
    startDragging: (state: WallViewType) => {
      state.isDragging = true
    },
    stopDragging: (state: WallViewType) => {
      state.isDragging = false
    },
    startDraggingGroup: (state: WallViewType) => {
      state.isDraggingGroup = true
    },
    stopDraggingGroup: (state: WallViewType) => {
      state.isDraggingGroup = false
    },
    setShiftKeyDown: (state: WallViewType, action: PayloadAction<boolean>) => {
      state.isShiftKeyDown = action.payload
    },
    addArtworkToGroup: (state: WallViewType, action: PayloadAction<string>) => {
      state.artworkGroupIds.push(action.payload)
    },
    removeArtworkFromGroup: (state: WallViewType, action: PayloadAction<string>) => {
      state.artworkGroupIds = state.artworkGroupIds.filter((id) => id !== action.payload)
    },
    createArtworkGroup: (state: WallViewType, action: PayloadAction<ArtworkGroupType>) => {
      state.artworkGroup = action.payload
    },
    editArtworkGroup: (
      state: WallViewType,
      action: PayloadAction<{ groupX?: number; groupY?: number }>,
    ) => {
      state.artworkGroup.groupX = action.payload.groupX
      state.artworkGroup.groupY = action.payload.groupY
    },
    removeGroup: (state: WallViewType) => {
      state.artworkGroupIds = []
    },
    setGroupHovered: (state: WallViewType) => {
      state.isGroupHovered = true
    },
    setGroupNotHovered: (state: WallViewType) => {
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
