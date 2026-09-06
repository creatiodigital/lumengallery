import type { Mesh, BufferGeometry, MeshStandardMaterial, Texture } from 'three'
import type { GLTF } from 'three-stdlib'

import type { TArtwork } from '@/types/artwork'

// =============================================================================
// GLTF Types
// =============================================================================

/**
 * Base GLTF result type for space models.
 * Extend this for space-specific nodes/materials.
 */
export type BaseGLTFResult = GLTF & {
  nodes: {
    floor: Mesh & { geometry: BufferGeometry }
    ceiling: Mesh & { geometry: BufferGeometry }
    [key: string]: Mesh
  }
  materials: {
    floorMaterial: MeshStandardMaterial & { map?: Texture }
    ceilingMaterial: MeshStandardMaterial & { map?: Texture }
    [key: string]: MeshStandardMaterial | undefined
  }
}

// =============================================================================
// Space Props Types
// =============================================================================

/**
 * Ref types that spaces can use for collision detection.
 * Each space defines which refs it needs.
 */
export type SpaceRefs = {
  wallRefs?: React.RefObject<Mesh | null>[]
  windowRefs?: React.RefObject<Mesh | null>[]
  glassRefs?: React.RefObject<Mesh | null>[]
  // Add more ref types as needed for new spaces
  [key: string]: React.RefObject<Mesh | null>[] | undefined
}

/**
 * Base props that all space components receive.
 */
export type BaseSpaceProps = React.ComponentProps<'group'> & {
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
} & SpaceRefs

// =============================================================================
// Space Configuration Types
// =============================================================================

/**
 * Configuration for ref counts per space.
 * Defines how many of each ref type the space needs.
 */
export type SpaceRefsCount = {
  walls?: number
  windows?: number
  glass?: number
  // Extensible for future ref types
  [key: string]: number | undefined
}

/**
 * Complete configuration for a space.
 * Used for space registry and UI.
 */
export type SpaceConfig = {
  /** Display name for UI */
  displayName: string
  /** Path to GLTF model */
  gltfPath: string
  /** Ref counts, when a space needs to override what is counted from the model */
  refs?: SpaceRefsCount
  /** Default camera start position [x, z] — camera will be placed at (x, cameraElevation, z) */
  defaultCameraPosition?: [number, number]
}
