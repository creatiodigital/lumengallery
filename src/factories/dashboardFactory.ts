import type { TDashboardState } from '@/types/dashboard'

export const createDashboardState = (): TDashboardState => ({
  isEditMode: false,
  isArtworkPanelOpen: false,
  isArtworkModalOpen: false,
  isLightingPanelOpen: false,
  isFloorPanelOpen: false,
  isCameraPanelOpen: false,
  isHumanPanelOpen: false,

  isWallCeilingPanelOpen: false,
  isEditingArtwork: false,
  selectedSpace: { label: 'Paris', value: 'paris' },
})
