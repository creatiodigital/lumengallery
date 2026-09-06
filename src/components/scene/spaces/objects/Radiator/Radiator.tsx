import { useMemo } from 'react'
import { Mesh, BufferGeometry } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'

interface RadiatorProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
  radiatorRef?: React.Ref<Mesh>
}

const Radiator: React.FC<RadiatorProps> = ({ nodes, count, radiatorRef }) => {
  // Count comes from the GLB unless a space deliberately overrides it, so a
  // bigger space needs no code change to show all of its props.
  const resolvedCount = count ?? countNodes(nodes, 'radiator')
  // Tinted color that responds to ambient light
  const tintedColor = useAmbientLightColor('#e8e8e8')

  const indices = useMemo(() => Array.from({ length: resolvedCount }, (_, i) => i), [resolvedCount])

  return (
    <>
      {indices.map((i) => {
        const node = nodes[`radiator${i}`]
        if (!node) return null
        return (
          <mesh
            key={`radiator-${i}`}
            ref={i === 0 ? radiatorRef : undefined}
            name={`radiator${i}`}
            geometry={node.geometry}
            position={node.position}
            rotation={node.rotation}
            scale={node.scale}
          >
            <meshStandardMaterial color={tintedColor} roughness={0.5} />
          </mesh>
        )
      })}
    </>
  )
}

export default Radiator
