export type WallType = {
  id: string
  name: string
}

export type CoordinatesType = {
  x: number
  y: number
  z: number
}

export type PanPositionType = {
  x: number
  y: number
}

export type WallDimensionsType = {
  width: number | null
  height: number | null
}

export type ArtworkGroupType = {
  groupX?: number
  groupY?: number
  [key: string]: unknown
}

export type WallViewType = {
  isWallView: boolean
  currentArtworkId: string | null
  currentWallId: string | null
  currentWallCoordinates: CoordinatesType
  currentWallNormal: CoordinatesType
  scaleFactor: number
  panPosition: PanPositionType
  isHumanVisible: boolean
  wallHeight: number | null
  wallWidth: number | null
  isDragging: boolean
  isDraggingGroup: boolean
  isShiftKeyDown: boolean
  artworkGroupIds: string[]
  artworkGroup: ArtworkGroupType
  isGroupHovered: boolean
  alignedPairs: unknown[]
}
