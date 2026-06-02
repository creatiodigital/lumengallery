import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createDashboardState } from '@/factories/dashboardFactory'
import type { TDashboardState, TSpaceOption } from '@/types/dashboard'

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: createDashboardState(),
  reducers: {
    showEditMode: (state: TDashboardState) => {
      state.isEditMode = true
    },
    hideEditMode: (state: TDashboardState) => {
      state.isEditMode = false
    },
    showArtworkPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = true
    },
    hideArtworkPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
    },
    openArtworkModal: (state: TDashboardState) => {
      state.isArtworkModalOpen = true
    },
    closeArtworkModal: (state: TDashboardState) => {
      state.isArtworkModalOpen = false
    },
    showLightingPanel: (state: TDashboardState) => {
      state.isLightingPanelOpen = true
    },
    hideLightingPanel: (state: TDashboardState) => {
      state.isLightingPanelOpen = false
    },
    showFloorPanel: (state: TDashboardState) => {
      state.isFloorPanelOpen = true
    },
    hideFloorPanel: (state: TDashboardState) => {
      state.isFloorPanelOpen = false
    },
    showCameraPanel: (state: TDashboardState) => {
      state.isCameraPanelOpen = true
    },
    hideCameraPanel: (state: TDashboardState) => {
      state.isCameraPanelOpen = false
    },
    showHumanPanel: (state: TDashboardState) => {
      state.isHumanPanelOpen = true
    },
    hideHumanPanel: (state: TDashboardState) => {
      state.isHumanPanelOpen = false
    },

    showWallCeilingPanel: (state: TDashboardState) => {
      state.isWallCeilingPanelOpen = true
    },
    hideWallCeilingPanel: (state: TDashboardState) => {
      state.isWallCeilingPanelOpen = false
    },
    setEditingArtwork: (state: TDashboardState, action: PayloadAction<boolean>) => {
      state.isEditingArtwork = action.payload
    },
    selectSpace: (state: TDashboardState, action: PayloadAction<TSpaceOption>) => {
      state.selectedSpace = action.payload
    },
  },
})

export const {
  showEditMode,
  hideEditMode,
  showArtworkPanel,
  hideArtworkPanel,
  openArtworkModal,
  closeArtworkModal,
  showLightingPanel,
  hideLightingPanel,
  showFloorPanel,
  hideFloorPanel,
  showCameraPanel,
  hideCameraPanel,
  showHumanPanel,
  hideHumanPanel,

  showWallCeilingPanel,
  hideWallCeilingPanel,
  setEditingArtwork,
  selectSpace,
} = dashboardSlice.actions

export default dashboardSlice.reducer
