import { useGLTF, useKTX2, SoftShadows, BakeShadows, Preload } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh, BufferGeometry, MeshLambertMaterial, SRGBColorSpace, Color } from 'three'
import type { GLTF } from 'three-stdlib'

import { TextureMemoryReadout } from '@/components/scene/TextureMemoryReadout'
import { ScenePerfHud } from '@/components/scene/ScenePerfHud'
import { ArtObjects } from '@/components/scene/spaces/objects/ArtObjects'
import { Ceiling } from '@/components/scene/spaces/objects/Ceiling'
import { Effects } from '@/components/scene/spaces/objects/Effects'
import { ContinueSign } from '@/components/scene/spaces/objects/ContinueSign'
import { ExitSign } from '@/components/scene/spaces/objects/ExitSign'
import { ExitTrigger } from '@/components/scene/spaces/objects/ExitTrigger'
import { ReflectiveFloor } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { ParisWindow } from '@/components/scene/spaces/objects/ParisWindow'
import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'
import { Radiator } from '@/components/scene/spaces/objects/Radiator'
import { RecessedLamp } from '@/components/scene/spaces/objects/RecessedLamp'
import RoundLamp from '@/components/scene/spaces/objects/RoundLamp/RoundLamp'
import { SingleSocket } from '@/components/scene/spaces/objects/SingleSocket'
import { Switch } from '@/components/scene/spaces/objects/Switch'
import { TrackLamp } from '@/components/scene/spaces/objects/TrackLamp'
import { Wall } from '@/components/scene/spaces/objects/Wall'
import {
  bakeWorldTransforms,
  countNodes,
  groupNodesByRoom,
} from '@/components/scene/spaces/objects/nodeIndices'

import { useAmbientLight } from '@/hooks/useAmbientLight'
import { addWall, setInitialCameraFromNode, setTrackLampGroups } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'
import { assetUrl } from '@/lib/assetUrl'
// The registry owns each space's model path, so the scene and the wall-view
// editor can never end up loading two different files.
import { spaceConfigs } from '@/components/scene/constants'

// Vienna is Paris's lighting rig at a larger scale, so it reuses that module
// rather than duplicating it. If the two ever need to diverge, copy it here then
// — a second identical file today would only drift.
import { Lights } from '@/components/scene/spaces/ParisSpace/lights'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

// Prop families whose nodes hang off a room Empty in the Vienna GLB. Their
// ancestor transforms have to be collapsed into the nodes themselves before
// anything mounts — see `bakeWorldTransforms`.
const ROOM_PARENTED_PREFIXES = [
  'placeholder',
  'trackLampArm',
  'roundLampBody',
  'recessedLampBody',
] as const

type GLTFResult = GLTF & {
  nodes: {
    floor0: Mesh & { geometry: BufferGeometry; material: MeshLambertMaterial }
    ceiling0: Mesh & { geometry: BufferGeometry; material: MeshLambertMaterial }
    wall0: Mesh & { geometry: BufferGeometry; material: MeshLambertMaterial }
    [key: string]: Mesh
  }
}

type ViennaSpaceProps = React.ComponentProps<'group'> & {
  wallRefs: React.RefObject<Mesh | null>[]
  windowRefs: React.RefObject<Mesh | null>[]
  glassRefs: React.RefObject<Mesh | null>[]
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

const ViennaSpace: React.FC<ViennaSpaceProps> = ({ wallRefs, windowRefs, glassRefs, ...props }) => {
  const { nodes } = useGLTF(spaceConfigs.vienna.gltfPath) as unknown as GLTFResult

  const dispatch = useDispatch()
  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const ceilingLightMode = useSelector(
    (state: RootState) => state.exhibition.ceilingLightMode ?? 'track-plafond',
  )

  // Room membership FIRST — it reads `.parent`, which the next step leaves intact
  // but `<primitive>` would destroy on mount.
  const trackLampGroups = useMemo(() => groupNodesByRoom(nodes, 'trackLampArm'), [nodes])

  // Then collapse the room Empties' transforms into their children. Vienna's
  // Empties sit up to ~21 m from the origin, and R3F drops them on mount.
  useMemo(() => bakeWorldTransforms(nodes, ROOM_PARENTED_PREFIXES), [nodes])

  // Ambient light for wall/ceiling tinting
  const { ambientColor, scale } = useAmbientLight()

  // Independent wall & ceiling colors
  const wallColor = useSelector((state: RootState) => state.exhibition.wallColor ?? '#ffffff')
  const ceilingColor = useSelector((state: RootState) => state.exhibition.ceilingColor ?? '#ffffff')

  // Baked lighting, neutral (no albedo) so the wall colour above stays the
  // artist's to control. No module-scope preload: drei's useKTX2.preload never
  // calls detectSupport(renderer) and would poison the loader cache.
  const wallTexture = useKTX2(assetUrl('/assets/spaces/vienna/textures/bgw1.ktx2?v=4'), '/basis/')
  const ceilingTexture = useKTX2(
    assetUrl('/assets/spaces/vienna/textures/bgc1.ktx2?v=4'),
    '/basis/',
  )

  useMemo(() => {
    wallTexture.colorSpace = SRGBColorSpace
    wallTexture.flipY = false
    ceilingTexture.colorSpace = SRGBColorSpace
    ceilingTexture.flipY = false
  }, [wallTexture, ceilingTexture])

  // Lambert rather than Standard: cheaper per-vertex lighting, and the lighting
  // is already baked into the map anyway.
  const wallMaterial = useMemo(
    () => new MeshLambertMaterial({ map: wallTexture, side: 2 }),
    [wallTexture],
  )
  useDisposable(wallMaterial)
  const ceilingMaterial = useMemo(
    () => new MeshLambertMaterial({ map: ceilingTexture, side: 2 }),
    [ceilingTexture],
  )
  useDisposable(ceilingMaterial)

  // Lambert compensation: it lacks PBR specular, so walls read dimmer. Boost
  // wall/ceiling brightness rather than cranking ambient, which would over-light
  // the artwork.
  const wallBrightness = useSelector((state: RootState) => state.exhibition.wallBrightness ?? 1.8)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const ambientTint = new Color(ambientColor).multiplyScalar(scale * wallBrightness)
    wallMaterial.color = ambientTint.clone().multiply(new Color(wallColor))
    ceilingMaterial.color = ambientTint.clone().multiply(new Color(ceilingColor))
    invalidate()
  }, [
    wallMaterial,
    ceilingMaterial,
    ambientColor,
    scale,
    wallColor,
    ceilingColor,
    wallBrightness,
    invalidate,
  ])

  // Count comes from the model — Vienna has 8 where Paris has 4.
  const placeholderCount = useMemo(() => countNodes(nodes, 'placeholder'), [nodes])
  const placeholdersArray = useMemo(
    () => Array.from({ length: placeholderCount }),
    [placeholderCount],
  )

  useEffect(() => {
    placeholdersArray.forEach((_, i) => {
      const placeholderNode = nodes[`placeholder${i}`]
      if (placeholderNode) dispatch(addWall({ id: placeholderNode.uuid }))
    })
  }, [nodes, dispatch, placeholdersArray])

  useEffect(() => {
    dispatch(setTrackLampGroups(trackLampGroups))
  }, [dispatch, trackLampGroups])

  // Camera start. useLayoutEffect so the dispatch lands before paint and the
  // camera never visibly jumps.
  useLayoutEffect(() => {
    const initialNode = nodes.initialPoint0
    if (!initialNode) return

    const pos: [number, number] = [initialNode.position.x, initialNode.position.z]

    // Facing comes from the first vertex normal, negated — the normal points off
    // the face, the visitor should look into the room.
    let dir: [number, number] = [0, -1]
    const normalAttr = initialNode.geometry?.attributes.normal
    if (normalAttr && normalAttr.count > 0) {
      const nx = -normalAttr.getX(0)
      const nz = -normalAttr.getZ(0)
      const len = Math.sqrt(nx * nx + nz * nz)
      if (len > 0.001) dir = [nx / len, nz / len]
    }

    dispatch(setInitialCameraFromNode({ position: pos, direction: dir }))
  }, [nodes, dispatch])

  return (
    <group {...props} dispose={null}>
      <Lights />
      <SoftShadows size={10} samples={16} focus={0} />
      <BakeShadows />
      <Effects enabled={true} />

      {/* Floor — the reflector is a flat plane sized from the mesh's bounds, so
          the real floor mesh is kept only for its geometry and hidden. */}
      {nodes.floor0 &&
        (() => {
          nodes.floor0.geometry.computeBoundingBox()
          const bb = nodes.floor0.geometry.boundingBox!
          const sx = nodes.floor0.scale.x
          const sy = nodes.floor0.scale.y
          const sz = nodes.floor0.scale.z
          const centerX = nodes.floor0.position.x + ((bb.max.x + bb.min.x) / 2) * sx
          const centerZ = nodes.floor0.position.z + ((bb.max.z + bb.min.z) / 2) * sz
          const floorSurfaceY = nodes.floor0.position.y + (bb.max.y ?? 0) * sy
          const floorWidth = (bb.max.x - bb.min.x) * sx
          const floorDepth = (bb.max.z - bb.min.z) * sz
          return (
            <>
              <primitive object={nodes.floor0} visible={false} />
              <ReflectiveFloor
                position={[centerX, floorSurfaceY, centerZ]}
                width={floorWidth}
                depth={floorDepth}
              />
            </>
          )
        })()}

      {nodes.ceiling0 && (
        <Ceiling
          geometry={nodes.ceiling0.geometry}
          material={ceilingMaterial}
          position={[
            nodes.ceiling0.position.x,
            nodes.ceiling0.position.y,
            nodes.ceiling0.position.z,
          ]}
        />
      )}

      {nodes.wall0 && (
        <Wall
          i={0}
          wallRef={wallRefs[0]}
          geometry={nodes.wall0.geometry}
          material={wallMaterial}
          position={[nodes.wall0.position.x, nodes.wall0.position.y, nodes.wall0.position.z]}
        />
      )}

      {/* Every prop family below counts its own nodes from the GLB, so Vienna's
          larger numbers need no arguments here. */}
      <ParisWindow nodes={nodes} windowRefs={windowRefs} glassRefs={glassRefs} />

      <Radiator nodes={nodes} radiatorRef={wallRefs[1]} />

      {(ceilingLightMode === 'track' || ceilingLightMode === 'track-plafond') && (
        <TrackLamp nodes={nodes} />
      )}
      {ceilingLightMode === 'track-plafond' && <RecessedLamp nodes={nodes} />}
      {ceilingLightMode === 'plafond' && <RoundLamp nodes={nodes} />}

      <SingleSocket nodes={nodes} />
      <Switch nodes={nodes} />

      {isPlaceholdersShown &&
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}

      {/* Exit sign in the entrance corridor, beside `invisibleWall0`. Vienna
          names it `exit0` rather than Paris/Madrid's `leftExit0`, hence the
          override. */}
      <ExitSign nodes={nodes} name="exit0" />

      {/* Wayfinding sign deeper in the building, pointing on to the next room
          instead of out of the gallery. Vienna is the only space with an
          onward room, so it is the only one that authors a `continue0`. */}
      <ContinueSign nodes={nodes} />

      {/* Blocks the camera at the end of the entrance corridor AND doubles as
          the exit trigger — one authored mesh does both. Hidden rather than
          transparent: `visible={false}` still raycasts. */}
      {nodes.invisibleWall0 && (
        <mesh
          ref={wallRefs[2]}
          name="invisibleWall0"
          geometry={nodes.invisibleWall0.geometry}
          position={nodes.invisibleWall0.position}
          rotation={nodes.invisibleWall0.rotation}
          scale={nodes.invisibleWall0.scale}
          visible={false}
        />
      )}

      <ExitTrigger nodes={nodes} />

      {nodes.initialPoint0 && <primitive object={nodes.initialPoint0} visible={false} />}

      <ArtObjects />
      <TextureMemoryReadout />
      {process.env.NEXT_PUBLIC_APP_ENV !== 'production' && <ScenePerfHud />}

      <Preload all />
    </group>
  )
}

export default ViennaSpace
