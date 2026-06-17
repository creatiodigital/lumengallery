import type { TScene } from '@/types/scene'

export const sceneFactory = (): TScene => ({
  isArtworkPanelOpen: false,
  isPlaceholdersShown: true,
  currentArtworkId: null,
  walls: [],
  focusTarget: null,
  initialCameraPosition: null,
  initialCameraDirection: null,
})
