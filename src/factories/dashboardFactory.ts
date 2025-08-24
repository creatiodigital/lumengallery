import type { TDashboardState } from '@/types/dashboard'

export const createDashboardState = (): TDashboardState => ({
  isEditMode: false,
  isArtworkPanelOpen: false,
  isEditingArtwork: false,
  selectedSpace: { label: 'Classic', value: 'classic' },
})
