export type TSpaceOption = {
  label: string
  value: 'classic' | 'modern'
}

export type DashboardStateType = {
  isEditMode: boolean
  isArtworkPanelOpen: boolean
  isEditingArtwork: boolean
  selectedSpace: TSpaceOption
}
