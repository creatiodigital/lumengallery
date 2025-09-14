import React from 'react'
import { Mesh, BufferGeometry, Material } from 'three'

interface RectLampProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  rectLampMaterial: Material
}

const RectLamp: React.FC<RectLampProps> = ({ i, nodes, rectLampMaterial }) => {
  return (
    <mesh
      name={`rectlamp${i}`}
      geometry={nodes[`rectlamp${i}`].geometry}
      material={rectLampMaterial}
    />
  )
}

export default RectLamp
