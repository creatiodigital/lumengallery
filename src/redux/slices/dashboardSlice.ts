import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createDashboardState } from '@/factories/dashboardFactory'
import type { DashboardState, SpaceOptionType } from '@/types/dashboard'

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: createDashboardState(),
  reducers: {
    showEditMode: (state: DashboardState) => {
      state.isEditMode = true
    },
    hideEditMode: (state: DashboardState) => {
      state.isEditMode = false
    },
    showArtworkPanel: (state: DashboardState) => {
      state.isArtworkPanelOpen = true
    },
    hideArtworkPanel: (state: DashboardState) => {
      state.isArtworkPanelOpen = false
    },
    setEditingArtwork: (state: DashboardState, action: PayloadAction<boolean>) => {
      state.isEditingArtwork = action.payload
    },
    selectSpace: (state: DashboardState, action: PayloadAction<SpaceOptionType>) => {
      state.selectedSpace = action.payload
    },
  },
})

export const {
  showEditMode,
  hideEditMode,
  showArtworkPanel,
  hideArtworkPanel,
  setEditingArtwork,
  selectSpace,
} = dashboardSlice.actions

export default dashboardSlice.reducer
