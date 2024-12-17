import { createSlice } from '@reduxjs/toolkit'

const sceneSlice = createSlice({
  name: 'scene',
  initialState: {
    isArtworkPanelOpen: false,
    currentArtworkId: null,
  },
  reducers: {
    showArtworkPanel: (state) => {
      state.isArtworkPanelOpen = true
    },
    hideArtworkPanel: (state) => {
      state.isArtworkPanelOpen = false
    },
    setCurrentArtwork: (state, action) => {
      state.currentArtworkId = action.payload
    },
  },
})

export const { showArtworkPanel, hideArtworkPanel, setCurrentArtwork } = sceneSlice.actions
export default sceneSlice.reducer
