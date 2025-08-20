export type SpaceOption = {
  label: string
  value: 'classic' | 'modern'
}

export type DashboardState = {
  isEditMode: boolean
  isArtworkPanelOpen: boolean
  isEditingArtwork: boolean
  selectedSpace: SpaceOption
}
