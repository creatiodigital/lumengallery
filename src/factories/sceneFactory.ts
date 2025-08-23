import type { SceneType } from '@/types/scene'

export const sceneFactory = (): SceneType => ({
  isArtworkPanelOpen: false,
  isPlaceholdersShown: true,
  currentArtworkId: null,
  walls: [],
})
