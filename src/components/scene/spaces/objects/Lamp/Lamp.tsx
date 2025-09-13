import React from 'react'
import { Mesh, BufferGeometry, Material } from 'three'

interface LampProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  lampMaterial: Material
  bulbMaterial: Material
}

const Lamp: React.FC<LampProps> = ({ i, nodes, lampMaterial, bulbMaterial }) => {
  return (
    <>
      <mesh
        name={`top${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`top${i}`].geometry}
        material={lampMaterial}
      />
      <mesh
        name={`base${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`base${i}`].geometry}
        material={lampMaterial}
      />
      <mesh
        name={`stick${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`stick${i}`].geometry}
        material={lampMaterial}
      />
      <mesh
        name={`bulb${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`bulb${i}`].geometry}
        material={bulbMaterial}
      />
    </>
  )
}

export default Lamp
