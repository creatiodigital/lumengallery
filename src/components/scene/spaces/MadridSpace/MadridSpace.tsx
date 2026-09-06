import { useGLTF, useKTX2, SoftShadows, BakeShadows, Preload } from '@react-three/drei'
import { ScenePerfHud } from '@/components/scene/ScenePerfHud'
import { TextureMemoryReadout } from '@/components/scene/TextureMemoryReadout'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh, BufferGeometry, MeshLambertMaterial, SRGBColorSpace, Color } from 'three'
import type { GLTF } from 'three-stdlib'

import { ArtObjects } from '@/components/scene/spaces/objects/ArtObjects'
import { Ceiling } from '@/components/scene/spaces/objects/Ceiling'

import { ReflectiveFloor } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { ParisWindow } from '@/components/scene/spaces/objects/ParisWindow'
import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'
import { Radiator } from '@/components/scene/spaces/objects/Radiator'
import RoundLamp from '@/components/scene/spaces/objects/RoundLamp/RoundLamp'
import { SingleSocket } from '@/components/scene/spaces/objects/SingleSocket'
import { Switch } from '@/components/scene/spaces/objects/Switch'
import { Wall } from '@/components/scene/spaces/objects/Wall'
import { Effects } from '@/components/scene/spaces/objects/Effects'
import { ExitSign } from '@/components/scene/spaces/objects/ExitSign'
import { ExitTrigger } from '@/components/scene/spaces/objects/ExitTrigger'

import { useAmbientLight } from '@/hooks/useAmbientLight'
import { addWall, setInitialCameraFromNode, setTrackLampGroups } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'
import { assetUrl } from '@/lib/assetUrl'
// The registry owns each space's model path, so the scene and the wall-view
// editor can never end up loading two different files.
import { spaceConfigs } from '@/components/scene/constants'

import { Lights } from './lights'
import { groupNodesByRoom } from '@/components/scene/spaces/objects/nodeIndices'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

// No module-scope preload for these: drei's useKTX2.preload only sets the
// transcoder path, never calling detectSupport(renderer). Since useLoader caches
// by loader instance, preloading would poison the cache with an uninitialised
// KTX2Loader and the component then throws. The in-component useKTX2 does it right.

type GLTFResult = GLTF & {
  nodes: {
    floor0: Mesh & { geometry: BufferGeometry; material: MeshLambertMaterial }
    ceiling0: Mesh & { geometry: BufferGeometry; material: MeshLambertMaterial }
    wall0: Mesh & { geometry: BufferGeometry; material: MeshLambertMaterial }
    [key: string]: Mesh
  }
}

type MadridSpaceProps = React.ComponentProps<'group'> & {
  wallRefs: React.RefObject<Mesh | null>[]
  windowRefs: React.RefObject<Mesh | null>[]
  glassRefs: React.RefObject<Mesh | null>[]
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

const MadridSpace: React.FC<MadridSpaceProps> = ({ wallRefs, windowRefs, glassRefs, ...props }) => {
  const { nodes } = useGLTF(spaceConfigs.madrid.gltfPath) as unknown as GLTFResult

  const dispatch = useDispatch()
  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)

  // Ambient light for wall/ceiling tinting
  const { ambientColor, scale } = useAmbientLight()

  // Independent wall & ceiling colors
  const wallColor = useSelector((state: RootState) => state.exhibition.wallColor ?? '#ffffff')
  const ceilingColor = useSelector((state: RootState) => state.exhibition.ceilingColor ?? '#ffffff')

  // Load external baked textures
  const wallTexture = useKTX2(assetUrl('/assets/spaces/madrid/textures/mwall2.ktx2'), '/basis/')
  const ceilingTexture = useKTX2(
    assetUrl('/assets/spaces/madrid/textures/mceiling2.ktx2'),
    '/basis/',
  )

  // Configure textures
  useMemo(() => {
    wallTexture.colorSpace = SRGBColorSpace
    wallTexture.flipY = false
    ceilingTexture.colorSpace = SRGBColorSpace
    ceilingTexture.flipY = false
  }, [wallTexture, ceilingTexture])

  // Create materials with baked textures
  const wallMaterial = useMemo(() => {
    return new MeshLambertMaterial({
      map: wallTexture,
      side: 2,
    })
  }, [wallTexture])
  useDisposable(wallMaterial)

  const ceilingMaterial = useMemo(() => {
    return new MeshLambertMaterial({
      map: ceilingTexture,
      side: 2,
    })
  }, [ceilingTexture])
  useDisposable(ceilingMaterial)

  // Apply ambient light tinting + independent wall/ceiling color
  // Lambert compensation: Lambert lacks PBR specular, so walls appear dimmer.
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

  // Arrays for iterating over indexed meshes
  const placeholdersArray = useMemo(() => Array.from({ length: 4 }), [])

  // Register placeholders with Redux
  useEffect(() => {
    placeholdersArray.forEach((_, i) => {
      const placeholderNode = nodes[`placeholder${i}`]
      if (placeholderNode) {
        dispatch(addWall({ id: placeholderNode.uuid }))
      }
    })
  }, [nodes, dispatch, placeholdersArray])

  // Which track lamps exist, and which room each belongs to. Derived during
  // render because R3F's <primitive> re-parents these nodes once they mount,
  // which would destroy the parent link this reads.
  const trackLampGroups = useMemo(() => groupNodesByRoom(nodes, 'trackLampArm'), [nodes])

  // Published to Redux so the lighting panel can show one control per lamp the
  // model actually has, instead of a count hard-coded in the UI.
  useEffect(() => {
    dispatch(setTrackLampGroups(trackLampGroups))
  }, [dispatch, trackLampGroups])

  // Extract initial camera position and direction from initialPoint0 node
  // useLayoutEffect ensures dispatch fires before paint, preventing camera jump
  useLayoutEffect(() => {
    const initialNode = nodes.initialPoint0
    if (initialNode) {
      // Use the node's position (Blender origin) directly
      const pos: [number, number] = [initialNode.position.x, initialNode.position.z]

      // Extract direction from the geometry's face normal (first vertex normal)
      let dir: [number, number] = [0, -1] // Fallback: look along -Z
      if (initialNode.geometry) {
        const normalAttr = initialNode.geometry.attributes.normal
        if (normalAttr && normalAttr.count > 0) {
          // Negate: normal points away from the face, camera should look the opposite way (into the room)
          const nx = -normalAttr.getX(0)
          const nz = -normalAttr.getZ(0)
          // Normalize the xz direction
          const len = Math.sqrt(nx * nx + nz * nz)
          if (len > 0.001) {
            dir = [nx / len, nz / len]
          }
        }
      }

      dispatch(setInitialCameraFromNode({ position: pos, direction: dir }))
    }
  }, [nodes, dispatch])

  return (
    <group {...props} dispose={null}>
      <Lights />
      <SoftShadows size={10} samples={16} focus={0} />
      <BakeShadows />
      <Effects enabled={true} />

      {/* Floor */}
      {nodes.floor0 &&
        (() => {
          nodes.floor0.geometry.computeBoundingBox()
          const bb = nodes.floor0.geometry.boundingBox!
          const sx = nodes.floor0.scale.x
          const sy = nodes.floor0.scale.y
          const sz = nodes.floor0.scale.z
          // Use the geometry's bounding box center (not mesh origin) for correct positioning
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

      {/* Ceiling */}
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

      {/* Wall */}
      {nodes.wall0 && (
        <Wall
          i={0}
          wallRef={wallRefs[0]}
          geometry={nodes.wall0.geometry}
          material={wallMaterial}
          position={[nodes.wall0.position.x, nodes.wall0.position.y, nodes.wall0.position.z]}
        />
      )}

      {/* Windows */}
      <ParisWindow nodes={nodes} windowRefs={windowRefs} glassRefs={glassRefs} />

      {/* Radiators */}
      <Radiator nodes={nodes} />

      {/* Round Lamps */}
      <RoundLamp nodes={nodes} />

      {/* Switches */}
      <Switch nodes={nodes} />

      {/* Single Sockets */}
      <SingleSocket nodes={nodes} />

      {/* Placeholders */}
      {isPlaceholdersShown &&
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}

      {/* Exit sign, read from the gallery so a visitor can find the way out. */}
      <ExitSign nodes={nodes} />

      {/* Invisible wall across the exit corridor: stops the camera before the
          dead end comes into view. Registered as a wallRef so the existing
          collision raycast treats it like any other wall, and hidden rather
          than transparent — `visible={false}` still raycasts, so it blocks
          without being drawn.
          It doubles as the exit trigger: `ExitTrigger` measures the distance to
          this same mesh, so one object placed by eye in Blender both blocks and
          asks. */}
      {nodes.invisibleWall0 && (
        <mesh
          ref={wallRefs[1]}
          name="invisibleWall0"
          geometry={nodes.invisibleWall0.geometry}
          position={nodes.invisibleWall0.position}
          rotation={nodes.invisibleWall0.rotation}
          scale={nodes.invisibleWall0.scale}
          visible={false}
        />
      )}

      {/* Exit prompt — raised on nearing the wall above. */}
      <ExitTrigger nodes={nodes} />

      {/* Initial Point (reference position) */}
      {nodes.initialPoint0 && <primitive object={nodes.initialPoint0} visible={false} />}

      <ArtObjects />
      <TextureMemoryReadout />
      {process.env.NEXT_PUBLIC_APP_ENV !== 'production' && <ScenePerfHud />}

      <Preload all />
    </group>
  )
}

export default MadridSpace
