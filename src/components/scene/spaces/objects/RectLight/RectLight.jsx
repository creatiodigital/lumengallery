import React, { useMemo } from 'react'
import { MeshStandardMaterial } from 'three'

const RectLight = ({ i, nodes }) => {
  const rectLightMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 1,
      }),
    [],
  )

  return (
    <mesh
      name={`rectLight${i}`}
      castShadow
      receiveShadow
      geometry={nodes[`rectLight${i}`].geometry}
      material={rectLightMaterial}
    />
  )
}

export default RectLight
