export type Wall = {
  id: string
  name: string
}

export type Coordinates = {
  x: number
  y: number
  z: number
}

export type PanPosition = {
  x: number
  y: number
}

export type WallDimensions = {
  width: number | null
  height: number | null
}

export type ArtworkGroup = {
  groupX?: number
  groupY?: number
  [key: string]: unknown
}

export type WallView = {
  isWallView: boolean
  currentArtworkId: string | null
  currentWallId: string | null
  currentWallCoordinates: Coordinates
  currentWallNormal: Coordinates
  scaleFactor: number
  panPosition: PanPosition
  isHumanVisible: boolean
  wallHeight: number | null
  wallWidth: number | null
  isDragging: boolean
  isDraggingGroup: boolean
  isShiftKeyDown: boolean
  artworkGroupIds: string[]
  artworkGroup: ArtworkGroup
  isGroupHovered: boolean
  alignedPairs: unknown[]
}
