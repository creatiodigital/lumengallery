import { createSlice } from '@reduxjs/toolkit'

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    isEditMode: false,
    isArtworkPanelOpen: false,
    isEditingArtwork: false,
    activeTooltipId: null, // Track the currently active tooltip
    lastTooltipOpenedAt: null,
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
    setTooltipOpen: (state, action) => {
      const { isOpen, id } = action.payload
      state.activeTooltipId = isOpen ? id : null
      if (isOpen) {
        state.lastTooltipOpenedAt = Date.now() // Update timestamp when a tooltip opens
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
  setTooltipOpen,
} = dashboardSlice.actions
export default dashboardSlice.reducer
