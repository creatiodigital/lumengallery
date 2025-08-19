import { createSlice } from '@reduxjs/toolkit'

const sceneSlice = createSlice({
  name: 'scene',
  initialState: {
    isArtworkPanelOpen: false,
    isPlaceholdersShown: true,
    currentArtworkId: null,
    walls: [],
  },
  reducers: {
    setCurrentArtwork: (state, action) => {
      state.currentArtworkId = action.payload
    },
    showPlaceholders: (state) => {
      state.isPlaceholdersShown = true
    },
    hidePlaceholders: (state) => {
      state.isPlaceholdersShown = false
    },
    addWall: (state, action) => {
      const wallId = action.payload
      const wallIndex = state.walls.length + 1
      const readableName = `Wall ${wallIndex}`
      state.walls.push({ id: wallId.id, name: readableName })
    },
    editWallName: (state, action) => {
      const { wallId, newName } = action.payload
      const wall = state.walls.find((wall) => wall.id === wallId)
      if (wall) {
        wall.name = newName
      }
    },
  },
})

export const { setCurrentArtwork, showPlaceholders, hidePlaceholders, addWall, editWallName } =
  sceneSlice.actions
export default sceneSlice.reducer
