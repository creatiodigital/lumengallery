import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { sceneFactory } from '@/factories/sceneFactory'
import type { TScene } from '@/types/scene'

const sceneSlice = createSlice({
  name: 'scene',
  initialState: sceneFactory(),
  reducers: {
    setCurrentArtwork: (state: TScene, action: PayloadAction<string | null>) => {
      state.currentArtworkId = action.payload
    },

    showPlaceholders: (state: TScene) => {
      state.isPlaceholdersShown = true
    },

    hidePlaceholders: (state: TScene) => {
      state.isPlaceholdersShown = false
    },

    addWall: (state: TScene, action: PayloadAction<{ id: string }>) => {
      const wallId = action.payload.id
      const wallIndex = state.walls.length + 1
      const readableName = `Wall ${wallIndex}`
      state.walls.push({ id: wallId, name: readableName })
    },

    editWallName: (state: TScene, action: PayloadAction<{ wallId: string; newName: string }>) => {
      const { wallId, newName } = action.payload
      const wall = state.walls.find((w) => w.id === wallId)
      if (wall) {
        wall.name = newName
      }
    },
  },
})

export const { setCurrentArtwork, showPlaceholders, hidePlaceholders, addWall, editWallName } =
  sceneSlice.actions

export default sceneSlice.reducer
