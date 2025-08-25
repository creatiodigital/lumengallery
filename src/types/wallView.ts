export type TWall = {
  id: string
  name: string
}

export type TCoordinates = {
  x: number
  y: number
  z: number
}

export type TAlignmentPair = {
  from: string
  to: string
  direction:
    | 'horizontal'
    | 'vertical'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'center-horizontal'
    | 'center-vertical'
}

export type TPanPosition = {
  x: number
  y: number
}

export type TWallDimensions = {
  width: number | null
  height: number | null
}

export type TArtworkGroup = {
  groupX?: number
  groupY?: number
  [key: string]: unknown
}

export type TWallView = {
  isWallView: boolean
  currentArtworkId: string | null
  currentWallId: string | null
  currentWallCoordinates: TCoordinates
  currentWallNormal: TCoordinates
  scaleFactor: number
  panPosition: TPanPosition
  isHumanVisible: boolean
  wallHeight: number | null
  wallWidth: number | null
  isDragging: boolean
  isDraggingGroup: boolean
  isShiftKeyDown: boolean
  artworkGroupIds: string[]
  artworkGroup: TArtworkGroup
  isGroupHovered: boolean
  alignedPairs: TAlignmentPair[]
  isGridVisible: boolean
}

export type TDirection =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
