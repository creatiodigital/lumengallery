import type { TArtworkPosition } from '@/types/artwork'
import type { AutofocusGroup } from '@/types/autofocusGroup'
import type { ExhibitionArtworkResponse } from '@/lib/exhibitionArtworkMapper'

export type TExhibition = {
  id: string
  userId: string
  name: string
  mainTitle: string
  url: string
  thumbnailUrl: string
  spaceId: string
  bannerUrl: string
  startDate: string
  endDate: string
  exhibitionArtworksById: Record<string, TArtworkPosition>
  allExhibitionArtworkIds: string[]
  /** Present on /api/exhibitions/by-url responses: positions + artwork
   *  metadata (snapshot enriched with live fields on the public path). The
   *  visit page feeds these straight into useLoadExhibitionArtworks so it
   *  doesn't need a second /api/exhibition-artworks request. */
  exhibitionArtworks?: ExhibitionArtworkResponse[]
  status: string
  published: boolean
  hasPendingChanges: boolean
  previewEnabled: boolean
  // Lighting customization
  ambientLightColor?: string
  ambientLightIntensity?: number
  skylightColor?: string
  skylightIntensity?: number
  ceilingLampColor?: string
  ceilingLampIntensity?: number
  trackLampColor?: string
  trackLampIntensity?: number
  trackLampsVisible?: boolean
  recessedLampColor?: string
  recessedLampIntensity?: number
  recessedLampAngle?: number
  recessedLampDistance?: number
  trackLampMaterialColor?: string
  trackLampAngle?: number
  trackLampDistance?: number
  trackLampSettings?: Record<string, { rotation: number; enabled: boolean; offset?: number }>
  windowLightColor?: string
  windowLightIntensity?: number
  windowTransparency?: boolean
  hdriRotation?: number
  floorReflectiveness?: number
  floorMaterial?:
    | 'concrete'
    | 'red-parquet'
    | 'marble'
    | 'parquet'
    | 'patterned-concrete'
    | 'worn-concrete'
    | 'wood-planks'
    | 'terrazzo'
    | 'parquet-light'
    | 'concrete-tiles'
  floorTextureScale?: number
  floorTextureOffsetX?: number
  floorTextureOffsetY?: number
  floorTemperature?: number
  floorNormalScale?: number
  floorRotation?: number
  // HDRI environment
  hdriEnvironment?: string
  ceilingLightMode?: string
  // Camera settings
  cameraFOV?: number
  cameraElevation?: number

  // Wall & Ceiling customization
  wallColor?: string
  ceilingColor?: string
  wallBrightness?: number

  // Shadow decal controls
  shadowBlur?: number
  shadowSpread?: number
  shadowOpacity?: number
  shadowDirection?: number

  // Autofocus groups
  autofocusGroups?: AutofocusGroup[]
}
