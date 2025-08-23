import type { WallViewType } from '@/types/wallView'

export const wallViewFactory = (): WallViewType => ({
  isWallView: false,
  currentArtworkId: null,
  currentWallId: null,
  currentWallCoordinates: { x: 0, y: 0, z: 0 },
  currentWallNormal: { x: 0, y: 0, z: 1 },
  scaleFactor: 1,
  panPosition: { x: -50, y: -50 },
  isHumanVisible: false,
  wallHeight: null,
  wallWidth: null,
  isDragging: false,
  isDraggingGroup: false,
  isShiftKeyDown: false,
  artworkGroupIds: [],
  artworkGroup: {},
  isGroupHovered: false,
  alignedPairs: [],
})
