import type { DashboardStateType } from '@/types/dashboard'

export const createDashboardState = (): DashboardStateType => ({
  isEditMode: false,
  isArtworkPanelOpen: false,
  isEditingArtwork: false,
  selectedSpace: { label: 'Classic', value: 'classic' },
})
