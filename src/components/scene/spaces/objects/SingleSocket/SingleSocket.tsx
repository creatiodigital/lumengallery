import { useMemo } from 'react'
import { Mesh, BufferGeometry } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'

interface SingleSocketProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

/**
 * Single socket (wall power outlet).
 * Iterates over indexed meshes: singleSocket0, singleSocket1, etc.
 */
const SingleSocket: React.FC<SingleSocketProps> = ({ nodes, count }) => {
  // Count comes from the GLB unless a space deliberately overrides it, so a
  // bigger space needs no code change to show all of its props.
  const resolvedCount = count ?? countNodes(nodes, 'singleSocket')
  const tintedPlastic = useAmbientLightColor('#d8d8d8')

  const socketsArray = useMemo(() => Array.from({ length: resolvedCount }), [resolvedCount])

  return (
    <>
      {socketsArray.map((_, i) => {
        const socketNode = nodes[`singleSocket${i}`]
        if (!socketNode) return null
        return (
          <mesh
            key={`singleSocket-${i}`}
            name={`singleSocket${i}`}
            geometry={socketNode.geometry}
            position={socketNode.position}
            rotation={socketNode.rotation}
            scale={socketNode.scale}
          >
            <meshStandardMaterial color={tintedPlastic} roughness={0.9} metalness={0.0} />
          </mesh>
        )
      })}
    </>
  )
}

export default SingleSocket
