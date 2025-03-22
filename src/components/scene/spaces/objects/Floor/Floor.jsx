import React, { useMemo } from 'react'
import { SRGBColorSpace } from 'three'

const Floor = ({ nodes, materials }) => {
  useMemo(() => {
    if (materials.floorMaterial?.map) {
      materials.floorMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])
  return (
    <mesh
      name="floor"
      castShadow
      receiveShadow
      geometry={nodes.floor.geometry}
      material={materials.floorMaterial}
    />
  )
}

export default Floor
