import React, { useMemo } from 'react'
import { MeshStandardMaterial } from 'three'

const Lamp = ({ i, nodes }) => {
  const lampMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.4,
      metalness: 0.1,
      envMapIntensity: 1,
    })
  }, [])

  const bulbMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 10,
      }),
    [],
  )

  return (
    <>
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
