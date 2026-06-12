import { useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { MeshReflectorMaterial } from '@react-three/drei'
import { Mesh, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'
import type { Vector3Tuple } from 'three'
import type { RootState } from '@/redux/store'
import { useResilientTexture } from '@/components/scene/useResilientTexture'
import { assetUrl } from '@/lib/assetUrl'

// Floor reflections disabled for performance
const ENABLE_REFLECTIONS = false

// Bump this version when replacing floor texture files to bust Three.js cache
const TEXTURE_VERSION = 3

interface ReflectiveFloorProps {
  position?: Vector3Tuple
  width?: number
  depth?: number
}

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3
const DEFAULT_FLOOR_TEXTURE_SCALE = 1.0

// Temperature color presets
const COOL_COLOR = { r: 0x8a, g: 0x92, b: 0x98 } // Blue-gray
const NEUTRAL_COLOR = { r: 0x9a, g: 0x95, b: 0x8f } // Original
const WARM_COLOR = { r: 0xa8, g: 0x9a, b: 0x8a } // Amber

// Interpolate between colors based on temperature (-1 to 1)
const getTemperatureColor = (temperature: number): string => {
  const t = Math.max(-1, Math.min(1, temperature))
  let r, g, b

  if (t < 0) {
    // Cool: interpolate from neutral to cool
    const factor = -t
    r = Math.round(NEUTRAL_COLOR.r + (COOL_COLOR.r - NEUTRAL_COLOR.r) * factor)
    g = Math.round(NEUTRAL_COLOR.g + (COOL_COLOR.g - NEUTRAL_COLOR.g) * factor)
    b = Math.round(NEUTRAL_COLOR.b + (COOL_COLOR.b - NEUTRAL_COLOR.b) * factor)
  } else {
    // Warm: interpolate from neutral to warm
    const factor = t
    r = Math.round(NEUTRAL_COLOR.r + (WARM_COLOR.r - NEUTRAL_COLOR.r) * factor)
    g = Math.round(NEUTRAL_COLOR.g + (WARM_COLOR.g - NEUTRAL_COLOR.g) * factor)
    b = Math.round(NEUTRAL_COLOR.b + (WARM_COLOR.b - NEUTRAL_COLOR.b) * factor)
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Material configurations with file extensions (optional maps set to null)
const MATERIAL_CONFIG: Record<
  string,
  {
    diffuse: string
    normal: string | null
    bump: string | null
    roughness: string | null
    metallic: string | null
    ao: string | null
  }
> = {
  concrete: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: 'metallic.jpg',
    ao: null,
  },
  'red-parquet': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  marble: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: null,
  },

  parquet: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  'patterned-concrete': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  'worn-concrete': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: 'metallic.jpg',
    ao: 'ao.jpg',
  },
  'wood-planks': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  terrazzo: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: null,
  },
  'parquet-light': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: null,
  },
  'concrete-tiles': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
}

// Preload all floor textures at module scope so useTexture doesn't trigger
// loading manager state updates during render (fixes Loader setState warning)
Object.entries(MATERIAL_CONFIG).forEach(([material, config]) => {
  const basePath = assetUrl(`/assets/materials/${material}`)
  const v = `?v=${TEXTURE_VERSION}`
  const paths: Record<string, string> = {
    map: `${basePath}/${config.diffuse}${v}`,
  }
  if (config.roughness) paths.roughnessMap = `${basePath}/${config.roughness}${v}`
  if (config.normal) paths.normalMap = `${basePath}/${config.normal}${v}`
  if (config.bump) paths.bumpMap = `${basePath}/${config.bump}${v}`
  if (config.metallic) paths.metalnessMap = `${basePath}/${config.metallic}${v}`
  if (config.ao) paths.aoMap = `${basePath}/${config.ao}${v}`
  useResilientTexture.preload(Object.values(paths))
})

/**
 * Polished floor with mirror reflections and PBR textures.
 * Reads material, texture scale, and reflectiveness from Redux.
 */
const ReflectiveFloor: React.FC<ReflectiveFloorProps> = ({
  position = [0, 0, 0],
  width = 100,
  depth = 100,
}) => {
  const meshRef = useRef<Mesh>(null)

  // Read floor settings from Redux
  const floorMaterial = useSelector(
    (state: RootState) => state.exhibition.floorMaterial ?? 'concrete',
  )

  const floorTextureScale = useSelector(
    (state: RootState) => state.exhibition.floorTextureScale ?? DEFAULT_FLOOR_TEXTURE_SCALE,
  )

  const reflectiveness = useSelector(
    (state: RootState) => state.exhibition.floorReflectiveness ?? DEFAULT_FLOOR_REFLECTIVENESS,
  )

  const floorTextureOffsetX = useSelector(
    (state: RootState) => state.exhibition.floorTextureOffsetX ?? 0,
  )

  const floorTextureOffsetY = useSelector(
    (state: RootState) => state.exhibition.floorTextureOffsetY ?? 0,
  )

  const floorTemperature = useSelector((state: RootState) => state.exhibition.floorTemperature ?? 0)

  const floorNormalScale = useSelector(
    (state: RootState) => state.exhibition.floorNormalScale ?? 1.0,
  )

  const floorRotation = useSelector((state: RootState) => state.exhibition.floorRotation ?? 0)

  // Compute temperature-based floor color
  const floorColor = getTemperatureColor(floorTemperature)

  // Clamp scale for safety (0.5 = largest tiles, 5.0 = smallest)
  const clampedScale = Math.max(0.5, Math.min(8.0, floorTextureScale))

  // Resolve legacy/deleted material names to valid ones
  const MATERIAL_ALIASES: Record<string, string> = {
    chevron: 'parquet',
  }
  const resolvedMaterial = MATERIAL_ALIASES[floorMaterial] || floorMaterial
  const validMaterial = MATERIAL_CONFIG[resolvedMaterial] ? resolvedMaterial : 'concrete'

  // Get material config for dynamic texture paths
  const materialConfig = MATERIAL_CONFIG[validMaterial]
  const texturePath = assetUrl(`/assets/materials/${validMaterial}`)

  // Build texture paths (metallic, normal, and ao are optional) — memoized to avoid
  // unstable references that cause useTexture to re-trigger loading on every render
  const texturePaths = useMemo(() => {
    const v = `?v=${TEXTURE_VERSION}`
    const paths: Record<string, string> = {
      map: `${texturePath}/${materialConfig.diffuse}${v}`,
    }
    if (materialConfig.roughness) {
      paths.roughnessMap = `${texturePath}/${materialConfig.roughness}${v}`
    }
    if (materialConfig.normal) {
      paths.normalMap = `${texturePath}/${materialConfig.normal}${v}`
    }
    if (materialConfig.bump) {
      paths.bumpMap = `${texturePath}/${materialConfig.bump}${v}`
    }
    if (materialConfig.metallic) {
      paths.metalnessMap = `${texturePath}/${materialConfig.metallic}${v}`
    }
    if (materialConfig.ao) {
      paths.aoMap = `${texturePath}/${materialConfig.ao}${v}`
    }
    return paths
  }, [texturePath, materialConfig])

  // Load PBR textures with correct extensions per material. Uses the
  // resilient loader so a transient/aborted request retries and degrades
  // gracefully instead of throwing into the Canvas and crashing the scene.
  const textures = useResilientTexture(texturePaths)

  // Configure texture tiling, offset, and rotation
  useMemo(() => {
    const rotationRad = (floorRotation * Math.PI) / 180 // Convert degrees to radians
    // Scale repeat to maintain same physical tile size as the old 100-unit plane
    // Old: clampedScale * 10 on a 100-unit plane. Now: scale proportionally to actual floor size.
    const repeatX = clampedScale * 10 * (width / 100)
    const repeatY = clampedScale * 10 * (depth / 100)
    Object.values(textures).forEach((texture) => {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(repeatX, repeatY)
      texture.offset.set(floorTextureOffsetX, floorTextureOffsetY)
      texture.rotation = rotationRad
      texture.center.set(0.5, 0.5) // Rotate around center
    })
    textures.map.colorSpace = SRGBColorSpace
  }, [
    textures,
    clampedScale,
    floorTextureOffsetX,
    floorTextureOffsetY,
    floorRotation,
    width,
    depth,
  ])

  // Create Vector2 for normalScale (required by Three.js)
  const normalScaleVec = useMemo(
    () => new Vector2(floorNormalScale, floorNormalScale),
    [floorNormalScale],
  )

  return (
    <mesh
      ref={meshRef}
      name="floor"
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      receiveShadow
    >
      <planeGeometry
        args={[width, depth]}
        onUpdate={(geo) => {
          // AO maps require uv2 (attribute index 1). PlaneGeometry only has uv.
          if (!geo.attributes.uv2 && geo.attributes.uv) {
            geo.setAttribute('uv2', geo.attributes.uv)
          }
        }}
      />
      {ENABLE_REFLECTIONS ? (
        <MeshReflectorMaterial
          blur={[600, 400]} // Higher blur for maximum stability
          resolution={1024} // Full resolution for smooth reflections
          mixBlur={0.9} // High blend for stable reflections
          mixStrength={reflectiveness * 1.5} // Reduced from *3 to let normal map show
          roughness={1 - reflectiveness * 0.2}
          depthScale={0}
          color={floorColor}
          metalness={0.05}
          mirror={reflectiveness * 0.03}
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={[floorNormalScale, floorNormalScale]} // Controlled by Floor Details slider
          bumpMap={textures.bumpMap}
          bumpScale={floorNormalScale}
          roughnessMap={textures.roughnessMap}
          metalnessMap={textures.metalnessMap}
          aoMap={textures.aoMap}
          aoMapIntensity={1.0}
        />
      ) : (
        <meshStandardMaterial
          key={`floor-mat-${floorMaterial}`}
          color={floorColor}
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={normalScaleVec}
          bumpMap={textures.bumpMap}
          bumpScale={floorNormalScale}
          roughnessMap={textures.roughnessMap}
          metalnessMap={textures.metalnessMap}
          aoMap={textures.aoMap}
          aoMapIntensity={1.0}
          roughness={1 - reflectiveness * 0.7} // 0→1.0 (matte), 1→0.3 (shiny)
          metalness={0.05 + reflectiveness * 0.25} // More metallic at high reflectiveness
        />
      )}
    </mesh>
  )
}

export { ReflectiveFloor }
export default ReflectiveFloor
