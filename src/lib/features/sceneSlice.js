import { createSlice } from '@reduxjs/toolkit'

const sceneSlice = createSlice({
  name: 'scene',
  initialState: {
    isArtworkPanelOpen: false,
    isPlaceholdersShown: true,
    currentArtworkId: null,
  },
  reducers: {
    setCurrentArtwork: (state, action) => {
      state.currentArtworkId = action.payload
    },
    showPlaceholders: (state) => {
      console.log('ppp')
      state.isPlaceholdersShown = true
    },
    hidePlaceholders: (state) => {
      state.isPlaceholdersShown = false
    },
  },
})

export const { setCurrentArtwork, showPlaceholders, hidePlaceholders } = sceneSlice.actions
export default sceneSlice.reducer
