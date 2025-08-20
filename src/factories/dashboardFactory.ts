import type { DashboardState } from '@/types/dashboard'

export const createDashboardState = (): DashboardState => ({
  isEditMode: false,
  isArtworkPanelOpen: false,
  isEditingArtwork: false,
  selectedSpace: { label: 'Classic', value: 'classic' },
})
