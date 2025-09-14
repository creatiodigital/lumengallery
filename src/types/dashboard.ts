export type TSpaceOption = {
  label: string
  value: 'classic' | 'modern'
}

export type TDashboardState = {
  isEditMode: boolean
  isArtworkPanelOpen: boolean
  isEditingArtwork: boolean
  selectedSpace: TSpaceOption
}
