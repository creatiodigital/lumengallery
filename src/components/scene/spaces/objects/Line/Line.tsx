import React from 'react'
import { Mesh, BufferGeometry, Material } from 'three'

interface LineProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  lineMaterial: Material
}

const Line: React.FC<LineProps> = ({ i, nodes, lineMaterial }) => {
  return (
    <mesh
      name={`line${i}`}
      castShadow
      receiveShadow
      geometry={nodes[`line${i}`].geometry}
      material={lineMaterial}
    />
  )
}

export default Line
