import { useMemo } from 'react'
import { Mesh, BufferGeometry } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'

interface SwitchProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

/**
 * Wall switch (double switch).
 * Iterates over indexed meshes: doubleSwitch0, doubleSwitch1, etc.
 */
const Switch: React.FC<SwitchProps> = ({ nodes, count }) => {
  // Count comes from the GLB unless a space deliberately overrides it, so a
  // bigger space needs no code change to show all of its props.
  const resolvedCount = count ?? countNodes(nodes, 'doubleSwitch')
  const tintedPlastic = useAmbientLightColor('#d8d8d8')

  const switchesArray = useMemo(() => Array.from({ length: resolvedCount }), [resolvedCount])

  return (
    <>
      {switchesArray.map((_, i) => {
        const switchNode = nodes[`doubleSwitch${i}`]
        if (!switchNode) return null
        return (
          <mesh
            key={`doubleSwitch-${i}`}
            name={`doubleSwitch${i}`}
            geometry={switchNode.geometry}
            position={switchNode.position}
            rotation={switchNode.rotation}
            scale={switchNode.scale}
          >
            <meshStandardMaterial color={tintedPlastic} roughness={0.9} metalness={0.0} />
          </mesh>
        )
      })}
    </>
  )
}

export default Switch
