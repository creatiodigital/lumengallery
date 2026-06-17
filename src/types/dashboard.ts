export type TSpaceOption = {
  label: string
  value: 'paris' | string
}

export type TDashboardState = {
  isEditMode: boolean
  isArtworkPanelOpen: boolean
  isArtworkModalOpen: boolean
  isLightingPanelOpen: boolean
  isFloorPanelOpen: boolean
  isCameraPanelOpen: boolean

  isWallCeilingPanelOpen: boolean
  isEditingArtwork: boolean
  selectedSpace: TSpaceOption
}
