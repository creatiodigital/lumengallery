import React from 'react'
import { Mesh, BufferGeometry, Material } from 'three'

interface ReelProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  reelMaterial: Material
}

const Reel: React.FC<ReelProps> = ({ i, nodes, reelMaterial }) => {
  return (
    <mesh
      name={`reel${i}`}
      castShadow
      receiveShadow
      geometry={nodes[`reel${i}`].geometry}
      material={reelMaterial}
    />
  )
}

export default Reel
