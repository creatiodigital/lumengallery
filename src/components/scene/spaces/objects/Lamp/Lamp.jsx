import React from 'react'

const Lamp = ({ i, nodes, lampMaterial, bulbMaterial }) => {
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
