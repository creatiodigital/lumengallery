import type { TWall } from './wallView'

export type TFocusTarget = {
  artworkId: string
  position: { x: number; y: number; z: number }
  normal: { x: number; y: number; z: number }
  width: number
  height: number
}

/** Lamps of one kind, grouped by the room Empty they are parented under in the
 *  GLB. A space with no `room*` parents yields a single group with `room: null`,
 *  which is how Paris and Madrid behave — they keep a flat, ungrouped list. */
export type TLampGroup = { room: string | null; indices: number[] }

export type TScene = {
  isArtworkPanelOpen: boolean
  isPlaceholdersShown: boolean
  currentArtworkId: string | null
  walls: TWall[]
  focusTarget: TFocusTarget | null
  /** Dynamic camera start position [x, z] from GLB initialPoint node */
  initialCameraPosition: [number, number] | null
  /** Dynamic camera look direction [x, z] from GLB initialPoint normal */
  initialCameraDirection: [number, number] | null
  /**
   * "Leave the exhibition?" confirmation. Lives in scene state because it is
   * raised from two unrelated places — the corner close button in the
   * exhibition chrome, and walking past the exit threshold inside the 3D
   * scene — and both must drive the same single dialog.
   */
  isExitPromptOpen: boolean
  /**
   * Bumped when the visitor declines to leave. Choosing to stay returns them to
   * the entrance rather than leaving them standing on the exit threshold —
   * which also means the threshold can never re-fire under them, so no
   * arm/disarm bookkeeping is needed. A counter rather than a boolean so
   * repeated declines each register.
   */
  /** Track lamps present in the loaded space, in GLB order. Derived from the
   *  model at load, never persisted — the GLB is the source of truth for how
   *  many lamps a space has. */
  trackLampGroups: TLampGroup[]
  exitRespawnNonce: number
}
