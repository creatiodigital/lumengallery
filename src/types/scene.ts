import type { Wall } from './wallView'

export type Scene = {
  isArtworkPanelOpen: boolean
  isPlaceholdersShown: boolean
  currentArtworkId: string | null
  walls: Wall[]
}
