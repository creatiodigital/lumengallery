import type { TWall } from './wallView'

export type TScene = {
  isArtworkPanelOpen: boolean
  isPlaceholdersShown: boolean
  currentArtworkId: string | null
  walls: TWall[]
}
