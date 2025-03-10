import React, { useMemo } from 'react'
import { SRGBColorSpace } from 'three'

const Wall = ({ i, wallRef, nodes, materials }) => {
  useMemo(() => {
    if (materials.wallMaterial?.map) {
      materials.wallMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])

  return (
    <mesh
      name={`walls${i}`}
      ref={wallRef}
      castShadow
      receiveShadow
      geometry={nodes[`walls${i}`]?.geometry}
      material={materials?.wallMaterial}
    />
  )
}

export default Wall
