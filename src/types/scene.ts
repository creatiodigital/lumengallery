import type { WallType } from './wallView'

export type SceneType = {
  isArtworkPanelOpen: boolean
  isPlaceholdersShown: boolean
  currentArtworkId: string | null
  walls: WallType[]
}
