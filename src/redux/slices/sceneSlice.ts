import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { sceneFactory } from '@/factories/sceneFactory'
import type { TScene, TLampGroup, TFocusTarget } from '@/types/scene'

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

    setFocusTarget: (state: TScene, action: PayloadAction<TFocusTarget>) => {
      state.focusTarget = action.payload
    },

    clearFocusTarget: (state: TScene) => {
      state.focusTarget = null
    },

    resetScene: () => {
      // Return fresh initial state to prevent stale data between exhibitions
      return sceneFactory()
    },

    /** Set from the GLB at load. Replaces any previous space's lamps outright,
     *  so switching exhibitions can never leave a stale lamp count behind. */
    setTrackLampGroups: (state: TScene, action: PayloadAction<TLampGroup[]>) => {
      state.trackLampGroups = action.payload
    },
    setInitialCameraFromNode: (
      state: TScene,
      action: PayloadAction<{ position: [number, number]; direction: [number, number] }>,
    ) => {
      state.initialCameraPosition = action.payload.position
      state.initialCameraDirection = action.payload.direction
    },

    openExitPrompt: (state: TScene) => {
      state.isExitPromptOpen = true
    },

    /**
     * Declined to leave. Every way of saying no lands here — the Stay button,
     * Escape and a backdrop click — so they all behave identically, and the
     * visit always restarts from the entrance regardless of where the prompt
     * was raised. One rule, stated plainly in the dialog, instead of a
     * behaviour that changes depending on how you got there.
     */
    declineExit: (state: TScene) => {
      state.isExitPromptOpen = false
      state.exitRespawnNonce += 1
    },
  },
})

export const {
  setCurrentArtwork,
  showPlaceholders,
  hidePlaceholders,
  addWall,
  editWallName,
  setFocusTarget,
  clearFocusTarget,
  resetScene,
  setInitialCameraFromNode,
  setTrackLampGroups,
  openExitPrompt,
  declineExit,
} = sceneSlice.actions

export default sceneSlice.reducer
