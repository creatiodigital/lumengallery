import { createSlice } from '@reduxjs/toolkit'

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    isEditMode: false,
    isArtworkPanelOpen: false,
    isEditingArtwork: false,
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
    setEditingArtwork: (state, action) => {
      state.isEditingArtwork = action.payload
    },
  },
})

export const { showEditMode, hideEditMode, showArtworkPanel, hideArtworkPanel, setEditingArtwork } =
  dashboardSlice.actions
export default dashboardSlice.reducer
