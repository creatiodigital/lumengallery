import type { TWallView } from '@/types/wallView'

export const wallViewFactory = (): TWallView => ({
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
  artworkGroup: {
    groupY: 0,
    groupX: 0,
    groupHeight: 0,
    groupWidth: 0,
  },
  isGroupHovered: false,
  alignedPairs: [],
  isGridVisible: false,
})
