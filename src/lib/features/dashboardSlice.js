import { createSlice } from '@reduxjs/toolkit'

const dashboardSlice = createSlice({
  name: 'dashboard',
  isPlaceholdersShown: false,
  isArtworkPanelOpen: false,
  initialState: {
    isEditMode: false,
  },
  reducers: {
    showEditMode: (state) => {
      state.isEditMode = true
    },
    hideEditMode: (state) => {
      state.isEditMode = false
    },
    showArtworkPanel: (state) => {
      state.isArtworkPanelOpen = true
    },
    hideArtworkPanel: (state) => {
      state.isArtworkPanelOpen = false
    },
  },
})

export const { showEditMode, hideEditMode, showArtworkPanel, hideArtworkPanel } =
  dashboardSlice.actions
export default dashboardSlice.reducer
