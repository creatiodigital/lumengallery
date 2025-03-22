import { createSlice } from '@reduxjs/toolkit'

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    isEditMode: false,
    isArtworkPanelOpen: false,
    isEditingArtwork: false,
    selectedSpace: { label: 'Classic', value: 'classic' },
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
    selectSpace: (state, action) => {
      const space = action.payload
      if (space) {
        state.selectedSpace = space
      }
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
