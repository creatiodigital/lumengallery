/**
 * Space Configuration Registry
 *
 * Defines which lighting features are available for each space type.
 * Add entries here when creating new spaces.
 */

export type SpaceFeatures = {
  hasSkylight: boolean
  hasLamps: boolean
  hasTrackLamps: boolean
  hasRecessedLamps: boolean
  hasWindows: boolean
  hasReflectiveFloor: boolean
  /** Per-lamp offset axis: 'x' or 'z'. Lamps not listed default to 'x'. */
  trackLampOffsetAxes?: Record<number, 'x' | 'z'>
}

export const spaceConfig: Record<string, SpaceFeatures> = {
  paris: {
    hasSkylight: false,
    hasLamps: false,
    hasTrackLamps: true,
    hasRecessedLamps: true,
    hasWindows: true,
    hasReflectiveFloor: true,
    // Lamps 0-7 face walls along Z, lamps 8-13 face walls along X
    trackLampOffsetAxes: {
      0: 'x',
      1: 'x',
      2: 'x',
      3: 'x',
      4: 'x',
      5: 'x',
      6: 'x',
      7: 'x',
      8: 'z',
      9: 'z',
      10: 'z',
      11: 'z',
      12: 'z',
      13: 'z',
    },
  },
  // Vienna runs Paris's rig at a larger scale: track + recessed lamps, windows,
  // reflective floor. Track-lamp offset axes are omitted deliberately — with 28
  // lamps across two rooms the per-lamp map would be pure maintenance burden,
  // and lamps not listed default to 'x'.
  vienna: {
    hasSkylight: false,
    hasLamps: false,
    hasTrackLamps: true,
    hasRecessedLamps: true,
    hasWindows: true,
    hasReflectiveFloor: true,
  },
  madrid: {
    hasSkylight: false,
    hasLamps: false,
    hasTrackLamps: false,
    hasRecessedLamps: true,
    hasWindows: true,
    hasReflectiveFloor: true,
  },
}

/**
 * Get features for a space, with sensible defaults for unknown spaces.
 */
export const getSpaceFeatures = (spaceId: string): SpaceFeatures => {
  return (
    spaceConfig[spaceId] ?? {
      hasSkylight: false,
      hasLamps: false,
      hasTrackLamps: true,
      hasRecessedLamps: true,
      hasWindows: true,
      hasReflectiveFloor: true,
    }
  )
}
