import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createDashboardState } from '@/factories/dashboardFactory'
import type { DashboardStateType, SpaceOptionType } from '@/types/dashboard'

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: createDashboardState(),
  reducers: {
    showEditMode: (state: DashboardStateType) => {
      state.isEditMode = true
    },
    hideEditMode: (state: DashboardStateType) => {
      state.isEditMode = false
    },
    showArtworkPanel: (state: DashboardStateType) => {
      state.isArtworkPanelOpen = true
    },
    hideArtworkPanel: (state: DashboardStateType) => {
      state.isArtworkPanelOpen = false
    },
    setEditingArtwork: (state: DashboardStateType, action: PayloadAction<boolean>) => {
      state.isEditingArtwork = action.payload
    },
    selectSpace: (state: DashboardStateType, action: PayloadAction<SpaceOptionType>) => {
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
