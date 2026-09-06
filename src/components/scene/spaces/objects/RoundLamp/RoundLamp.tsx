import { useMemo, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry, DoubleSide, Vector3, SpotLight, MeshStandardMaterial } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import type { RootState } from '@/redux/store'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'
import { useActiveRoom } from '@/components/scene/spaces/objects/useActiveRoom'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface RoundLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0

/**
 * Round lamp using <primitive> to preserve Blender hierarchy (body → bulb).
 * Body position is the Blender origin. Bulb has a small local Y offset.
 * Materials are applied imperatively.
 * Reuses the recessed lamp color/intensity controls.
 */
const RoundLamp: React.FC<RoundLampProps> = ({ nodes, count }) => {
  // Count comes from the GLB unless a space deliberately overrides it.
  const resolvedCount = count ?? countNodes(nodes, 'roundLampBody')
  // Lights in the room the visitor is not in are switched off — three never
  // culls lights itself, so an unseen lamp costs a full frame's shading.
  const isRoomActive = useActiveRoom(nodes, 'roundLampBody')
  const tintedPlastic = useAmbientLightColor('#ffffff')

  const lampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const bulbEmissiveIntensity = lampIntensity
  const lampAngle = useSelector((state: RootState) => state.exhibition.recessedLampAngle ?? 0.45)
  const lampDistance = useSelector(
    (state: RootState) => state.exhibition.recessedLampDistance ?? 15,
  )

  // Shared materials — all 17 lamps use the same body and bulb material
  const bodyMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: tintedPlastic,
        roughness: 0.4,
        metalness: 0.0,
      }),
    [tintedPlastic],
  )
  useDisposable(bodyMaterial)

  const bulbMaterial = useMemo(
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
  useDisposable(bulbMaterial)

  // Apply shared materials imperatively (required when using <primitive>)
  useEffect(() => {
    for (let i = 0; i < resolvedCount; i++) {
      const bodyNode = nodes[`roundLampBody${i}`]
      const bulbNode = nodes[`roundLampBulb${i}`]
      if (bodyNode) bodyNode.material = bodyMaterial
      if (bulbNode) bulbNode.material = bulbMaterial
    }
  }, [nodes, resolvedCount, bodyMaterial, bulbMaterial])

  // Compute world-space bulb positions for spotlight placement
  const bulbPositions = useMemo(() => {
    const positions: Vector3[] = []
    for (let i = 0; i < resolvedCount; i++) {
      const bodyNode = nodes[`roundLampBody${i}`]
      const bulbNode = nodes[`roundLampBulb${i}`]

      if (bodyNode && bulbNode) {
        bodyNode.updateWorldMatrix(true, true)
        const worldPos = new Vector3()
        bulbNode.getWorldPosition(worldPos)
        positions.push(worldPos)
      } else if (bodyNode) {
        positions.push(new Vector3(bodyNode.position.x, bodyNode.position.y, bodyNode.position.z))
      } else {
        positions.push(new Vector3())
      }
    }
    return positions
  }, [nodes, resolvedCount])

  const lampsArray = useMemo(() => Array.from({ length: resolvedCount }), [resolvedCount])

  return (
    <>
      {lampsArray.map((_, i) => {
        const bodyNode = nodes[`roundLampBody${i}`]
        if (!bodyNode) return null

        const bulbPos = bulbPositions[i]

        return (
          <group key={`roundLamp-${i}`}>
            {/* Primitive preserves: body (with position) → bulb (with local offset) */}
            <primitive object={bodyNode} />

            {/* Per-lamp downward spotlight — no track lamps in plafond-only mode.
                Skipped entirely when the visitor is in another room. */}
            {isRoomActive(i) && (
              <>
                <object3D
                  position={[bulbPos.x, bulbPos.y - 10, bulbPos.z]}
                  ref={(obj) => {
                    if (obj) {
                      const light = obj.parent?.children.find((c) => c.type === 'SpotLight') as
                        | SpotLight
                        | undefined
                      if (light) light.target = obj
                    }
                  }}
                />
                <spotLight
                  position={[bulbPos.x, bulbPos.y, bulbPos.z]}
                  color={lampColor}
                  intensity={lampIntensity * 2}
                  angle={lampAngle}
                  penumbra={1}
                  distance={lampDistance}
                  decay={2}
                  castShadow={false}
                />
              </>
            )}
          </group>
        )
      })}
    </>
  )
}

export default RoundLamp
