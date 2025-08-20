import type { Scene } from '@/types/scene'

export const sceneFactory = (): Scene => ({
  isArtworkPanelOpen: false,
  isPlaceholdersShown: true,
  currentArtworkId: null,
  walls: [],
})
