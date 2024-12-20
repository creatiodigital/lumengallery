import React, { useMemo } from 'react'
import { SRGBColorSpace } from 'three'

const Wall = ({ i, wallRef, nodes, materials }) => {
  useMemo(() => {
    if (materials.floorMaterial?.map) {
      materials.floorMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])
  return (
    <mesh
      name={`wall${i}`}
      ref={wallRef}
      castShadow
      receiveShadow
      geometry={nodes[`wall${i}`]?.geometry}
      material={materials?.wallMaterial}
    />
  )
}

export default Wall
