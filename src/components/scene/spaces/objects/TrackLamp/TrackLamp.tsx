import { useMemo, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Mesh,
  BufferGeometry,
  DoubleSide,
  Vector3,
  Matrix3,
  Object3D,
  SpotLight,
  MeshStandardMaterial,
} from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { getSpaceFeatures } from '@/config/spaceConfig'
import type { RootState } from '@/redux/store'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'
import { useActiveRoom } from '@/components/scene/spaces/objects/useActiveRoom'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface TrackLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

/**
 * Aim recovered from the bulb mesh itself: the average of its vertex normals in
 * world space. The bulb is the emissive face at the end of the head, so its
 * normals all point where the lamp points.
 *
 * Used only when the body's tilt quaternion has been flattened to identity by
 * applying transforms in Blender. Measured identical across Paris and Vienna
 * (bulb0 -> (-0.02, -0.76, 0.65) in both), so it is a property of the fixture
 * rather than of any one space.
 */
const bulbNormalAim = (bulbNode: Mesh & { geometry: BufferGeometry }): Vector3 | null => {
  const attr = bulbNode.geometry?.attributes?.normal
  if (!attr || attr.count === 0) return null

  const sum = new Vector3()
  for (let k = 0; k < attr.count; k++) {
    sum.x += attr.getX(k)
    sum.y += attr.getY(k)
    sum.z += attr.getZ(k)
  }
  if (sum.lengthSq() < 1e-8) return null

  bulbNode.updateWorldMatrix(true, false)
  return sum.applyMatrix3(new Matrix3().getNormalMatrix(bulbNode.matrixWorld)).normalize()
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_MATERIAL_COLOR = '#ffffff'

/**
 * Native Three.js spotlight for a track lamp.
 * Position and target are in world space.
 */
const TrackSpotlight: React.FC<{
  position: Vector3
  aimDirection: Vector3
  color: string
  intensity: number
  angle: number
  distance: number
}> = ({ position, aimDirection, color, intensity, angle, distance }) => {
  const lightRef = useRef<SpotLight>(null)
  const targetRef = useRef<Object3D>(null)

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current
    }
  }, [])

  // Target placed along the aim direction, lower down (artwork height)
  const targetPos: [number, number, number] = [
    position.x + aimDirection.x * 2,
    position.y - 1.5,
    position.z + aimDirection.z * 2,
  ]

  return (
    <>
      <object3D ref={targetRef} position={targetPos} />
      <spotLight
        ref={lightRef}
        position={[position.x, position.y, position.z]}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={0.8}
        distance={distance}
        decay={2}
        castShadow={false}
      />
    </>
  )
}

/**
 * Track lamp component using <primitive> to preserve Blender hierarchy.
 *
 * Scene graph: armNode (Y rotation at top) → bodyNode (tilt) → bulbNode
 * The arm's position IS the Blender origin (pivot for Y-rotation).
 * Materials are applied imperatively since <primitive> reuses original objects.
 *
 * Supports per-lamp Y-rotation, position offset, and on/off toggle.
 */
const TrackLamp: React.FC<TrackLampProps> = ({ nodes, count }) => {
  // Count comes from the GLB unless a space deliberately overrides it, so a
  // bigger space needs no code change to show all of its props.
  const resolvedCount = count ?? countNodes(nodes, 'trackLampArm')
  // Lights in the room the visitor is not in are switched off — three never
  // culls lights itself, so an unseen lamp costs a full frame's shading.
  const isRoomActive = useActiveRoom(nodes, 'trackLampArm')
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'paris'
  const spaceFeatures = getSpaceFeatures(spaceId)

  const materialColor = useSelector(
    (state: RootState) => state.exhibition.trackLampMaterialColor ?? DEFAULT_MATERIAL_COLOR,
  )
  const tintedMaterial = useAmbientLightColor(materialColor)

  const lampColor = useSelector(
    (state: RootState) => state.exhibition.trackLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.trackLampIntensity ?? 4.0,
  )
  const lampAngle = useSelector((state: RootState) => state.exhibition.trackLampAngle ?? 0.45)
  const lampDistance = useSelector((state: RootState) => state.exhibition.trackLampDistance ?? 5.0)

  // Per-lamp settings (rotation + on/off + offset)
  const trackLampSettings = useSelector((state: RootState) => state.exhibition.trackLampSettings)

  const bulbEmissiveIntensity = 2

  // Shared materials — all track lamps reuse the same instances
  const armBodyMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: tintedMaterial,
        roughness: 0.4,
        metalness: 0.0,
      }),
    [tintedMaterial],
  )
  useDisposable(armBodyMaterial)

  const bulbOnMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#000000',
        emissive: lampColor,
        emissiveIntensity: bulbEmissiveIntensity,
        toneMapped: false,
        side: DoubleSide,
      }),
    [lampColor, bulbEmissiveIntensity],
  )
  useDisposable(bulbOnMaterial)

  const bulbOffMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#000000',
        emissive: '#cccccc',
        emissiveIntensity: 0.3,
        toneMapped: false,
        side: DoubleSide,
      }),
    [],
  )
  useDisposable(bulbOffMaterial)

  // Apply shared materials imperatively (required when using <primitive>)
  useEffect(() => {
    for (let i = 0; i < resolvedCount; i++) {
      const armNode = nodes[`trackLampArm${i}`]
      const bodyNode = nodes[`trackLampBody${i}`]
      const bulbNode = nodes[`trackLampBulb${i}`]

      const settings = trackLampSettings?.[String(i)]
      const isEnabled = settings?.enabled ?? true

      if (armNode) armNode.material = armBodyMaterial
      if (bodyNode) bodyNode.material = armBodyMaterial
      if (bulbNode) bulbNode.material = isEnabled ? bulbOnMaterial : bulbOffMaterial
    }
  }, [nodes, resolvedCount, armBodyMaterial, bulbOnMaterial, bulbOffMaterial, trackLampSettings])

  // Compute world-space bulb positions and aim directions using node transforms directly.
  // We can't use getWorldPosition() because <primitive> re-parents nodes.
  const lampData = useMemo(() => {
    const data: Array<{
      bulbWorldPos: Vector3
      aimDir: Vector3
    }> = []

    for (let i = 0; i < resolvedCount; i++) {
      const armNode = nodes[`trackLampArm${i}`]
      const bulbNode = nodes[`trackLampBulb${i}`]
      const bodyNode = nodes[`trackLampBody${i}`]

      let bulbWorldPos = new Vector3()
      let aimDir = new Vector3(0, -1, 0)

      if (armNode && bodyNode && bulbNode) {
        // Walk the transform chain manually: arm → body (with rotation) → bulb
        // 1. Bulb position in body-local space, rotated by body quaternion
        const bulbInBody = bulbNode.position.clone().applyQuaternion(bodyNode.quaternion)
        // 2. Body position in arm-local space + rotated bulb offset
        const bulbInArm = bodyNode.position.clone().add(bulbInBody)
        // 3. World position = arm position + arm-local bulb position
        bulbWorldPos = armNode.position.clone().add(bulbInArm)

        // Where a lamp points is normally carried by the body's tilt quaternion.
        // But if the model was exported after Ctrl+A > Rotation & Scale, that
        // tilt is baked into the mesh and the quaternion is left at identity —
        // the fixture still LOOKS aimed while the number the light reads is gone,
        // so every lamp fires horizontally. Detect that and recover the aim from
        // the bulb's geometry instead, which survives having transforms applied.
        const q = bodyNode.quaternion
        const tiltWasApplied =
          Math.abs(q.x) < 1e-4 &&
          Math.abs(q.y) < 1e-4 &&
          Math.abs(q.z) < 1e-4 &&
          Math.abs(Math.abs(q.w) - 1) < 1e-4

        const geometricAim = tiltWasApplied ? bulbNormalAim(bulbNode) : null

        if (geometricAim) {
          aimDir = geometricAim
        } else {
          // Authored tilt present: dominant horizontal axis of the bulb's offset,
          // rotated by the body. Ignores the small off-centre mounting offset
          // that would otherwise skew the aim.
          const bulbLocal = bulbNode.position
          const aimAxis =
            Math.abs(bulbLocal.x) > Math.abs(bulbLocal.z)
              ? new Vector3(Math.sign(bulbLocal.x), 0, 0)
              : new Vector3(0, 0, Math.sign(bulbLocal.z))
          aimDir = aimAxis.applyQuaternion(bodyNode.quaternion)
        }
      }

      data.push({ bulbWorldPos, aimDir })
    }

    return data
  }, [nodes, resolvedCount])

  const lampsArray = useMemo(() => Array.from({ length: resolvedCount }), [resolvedCount])

  return (
    <>
      {lampsArray.map((_, i) => {
        const armNode = nodes[`trackLampArm${i}`]
        if (!armNode) return null

        const { bulbWorldPos, aimDir } = lampData[i]

        // Per-lamp settings
        const settings = trackLampSettings?.[String(i)]
        const isEnabled = settings?.enabled ?? true
        const rotation = settings?.rotation ?? 0
        const rotationRad = (rotation * Math.PI) / 180
        const offset = settings?.offset ?? 0

        // Arm position = Blender origin (top of arm, ceiling connection)
        const armPos = armNode.position

        // Apply position offset on the axis configured for this lamp
        const axis = spaceFeatures.trackLampOffsetAxes?.[i] ?? 'x'
        const offsetPos: [number, number, number] = [
          armPos.x + (axis === 'x' ? offset : 0),
          armPos.y,
          armPos.z + (axis === 'z' ? offset : 0),
        ]

        return (
          <group key={`trackLamp-${i}`} position={offsetPos} rotation={[0, rotationRad, 0]}>
            <group position={[-armPos.x, -armPos.y, -armPos.z]}>
              {/* Primitive preserves: arm → body (with tilt rotation) → bulb */}
              <primitive object={armNode} />

              {/* Spotlight — inside inner group so -armPos cancels with offsetPos */}
              {isEnabled && isRoomActive(i) && (
                <TrackSpotlight
                  position={bulbWorldPos}
                  aimDirection={aimDir}
                  color={lampColor}
                  intensity={lampIntensity * 2}
                  angle={lampAngle}
                  distance={lampDistance}
                />
              )}
            </group>
          </group>
        )
      })}
    </>
  )
}

export default TrackLamp
