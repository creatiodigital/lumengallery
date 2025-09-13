import React from 'react'
import { Mesh, BufferGeometry, Material } from 'three'

interface CeilingGlassProps {
  nodes: {
    top: Mesh & {
      geometry: BufferGeometry
    }
  }
  topMaterial: Material
}

const CeilingGlass: React.FC<CeilingGlassProps> = ({ nodes, topMaterial }) => {
  return (
    <mesh
      name="top"
      castShadow
      receiveShadow
      geometry={nodes.top.geometry}
      material={topMaterial}
    />
  )
}

export default CeilingGlass
